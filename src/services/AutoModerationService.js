/**
 * Auto-Moderation Service
 * 
 * Filters profanity, spam, and inappropriate content from chat messages
 */

class AutoModerationService {
  constructor(prisma) {
    this.prisma = prisma;
    
    // Profanity filter - comprehensive list
    this.profanityList = [
      'fuck', 'shit', 'ass', 'bitch', 'damn', 'cunt', 'dick', 'cock',
      'pussy', 'bastard', 'whore', 'slut', 'fag', 'nigger', 'nigga',
      'retard', 'rape', 'nazi', 'hitler', 'kill yourself', 'kys',
      'suicide', 'die', 'cancer', 'aids', 'terrorist', 'bomb',
      // Variations and leetspeak
      'fck', 'fuk', 'sh1t', 'a$$', 'b1tch', 'd1ck', 'c0ck', 'fvck'
    ];
    
    // Spam patterns
    this.spamPatterns = [
      /(.)\1{5,}/i,                    // Repeated characters (aaaaaaa)
      /^\s*([A-Z\s!?]{15,})\s*$/,      // ALL CAPS SCREAMING
      /(https?:\/\/[^\s]+)/gi,         // URLs
      /(\b\d{10,}\b)/g,                // Phone numbers
      /(\w+@\w+\.\w+)/g,               // Email addresses
      /(\$\$\$|💰{3,}|💵{3,})/g        // Money spam
    ];
    
    // Scam/phishing keywords
    this.scamKeywords = [
      'free chips', 'hack', 'cheat', 'exploit', 'generator',
      'click here', 'visit my', 'check out', 'dm me', 'telegram',
      'whatsapp', 'discord.gg', 'bit.ly', 'tinyurl', 'giveaway',
      'double your', 'guaranteed win', 'secret method'
    ];
    
    // User strike system
    this.userStrikes = new Map(); // userId -> { count, lastStrike }
  }

  /**
   * Filter a chat message
   * Returns { allowed, filtered, reason, severity }
   */
  async filterMessage(userId, message, roomId = null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isBanned: true, warnCount: true, email: true, isAdmin: true }
    });

    // Admins bypass filters
    if (user?.isAdmin) {
      return { allowed: true, filtered: message, reason: null, severity: 'none' };
    }

    // Banned users can't send messages
    if (user?.isBanned) {
      return { allowed: false, filtered: null, reason: 'User is banned', severity: 'ban' };
    }

    // Check for profanity
    const profanityCheck = this.checkProfanity(message);
    if (profanityCheck.hasProfanity) {
      await this.logModeration(userId, 'AUTO_FILTER', profanityCheck.reason, {
        originalMessage: message,
        filteredMessage: profanityCheck.filtered
      });

      // Increment warnings
      await this.incrementWarning(userId, profanityCheck.reason);

      return {
        allowed: true,
        filtered: profanityCheck.filtered,
        reason: profanityCheck.reason,
        severity: 'medium'
      };
    }

    // Check for spam
    const spamCheck = this.checkSpam(message);
    if (spamCheck.isSpam) {
      await this.logModeration(userId, 'AUTO_FILTER', spamCheck.reason, {
        originalMessage: message
      });

      return {
        allowed: false,
        filtered: null,
        reason: spamCheck.reason,
        severity: 'medium'
      };
    }

    // Check for scams/phishing
    const scamCheck = this.checkScam(message);
    if (scamCheck.isScam) {
      await this.logModeration(userId, 'AUTO_FILTER', scamCheck.reason, {
        originalMessage: message
      });

      // Auto-warn for scam attempts
      await this.incrementWarning(userId, scamCheck.reason);

      return {
        allowed: false,
        filtered: null,
        reason: scamCheck.reason,
        severity: 'high'
      };
    }

    // Check rate limiting
    const rateLimitCheck = this.checkRateLimit(userId, message);
    if (rateLimitCheck.exceeded) {
      return {
        allowed: false,
        filtered: null,
        reason: 'Rate limit exceeded - slow down!',
        severity: 'low'
      };
    }

    // Message is clean
    return { allowed: true, filtered: message, reason: null, severity: 'none' };
  }

  /**
   * Check for profanity and filter it
   */
  checkProfanity(message) {
    const lowerMsg = message.toLowerCase();
    let hasProfanity = false;
    let filtered = message;
    let foundWords = [];

    for (const word of this.profanityList) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(lowerMsg)) {
        hasProfanity = true;
        foundWords.push(word);
        // Replace with asterisks
        filtered = filtered.replace(regex, '*'.repeat(word.length));
      }
    }

    return {
      hasProfanity,
      filtered,
      reason: hasProfanity ? `Profanity detected: ${foundWords.join(', ')}` : null
    };
  }

  /**
   * Check for spam patterns
   */
  checkSpam(message) {
    // Check each spam pattern
    for (const pattern of this.spamPatterns) {
      if (pattern.test(message)) {
        return {
          isSpam: true,
          reason: 'Spam detected'
        };
      }
    }

    // Check message length (too long = spam)
    if (message.length > 500) {
      return {
        isSpam: true,
        reason: 'Message too long'
      };
    }

    return { isSpam: false, reason: null };
  }

  /**
   * Check for scam/phishing attempts
   */
  checkScam(message) {
    const lowerMsg = message.toLowerCase();

    for (const keyword of this.scamKeywords) {
      if (lowerMsg.includes(keyword)) {
        return {
          isScam: true,
          reason: `Potential scam detected: "${keyword}"`
        };
      }
    }

    return { isScam: false, reason: null };
  }

  /**
   * Rate limiting - prevent message flooding
   */
  checkRateLimit(userId, message) {
    const now = Date.now();
    const userHistory = this.userStrikes.get(userId) || { messages: [], lastMessage: 0 };

    // Clear old messages (older than 10 seconds)
    userHistory.messages = userHistory.messages.filter(m => now - m < 10000);

    // Check if same message repeated
    const recentMessages = userHistory.messages.slice(-3);
    if (recentMessages.length >= 3) {
      return { exceeded: true, reason: 'Message flooding' };
    }

    // Add current message
    userHistory.messages.push(now);
    userHistory.lastMessage = now;
    this.userStrikes.set(userId, userHistory);

    // More than 5 messages in 10 seconds = flooding
    if (userHistory.messages.length > 5) {
      return { exceeded: true, reason: 'Too many messages' };
    }

    return { exceeded: false };
  }

  /**
   * Increment user warning count
   */
  async incrementWarning(userId, reason) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        warnCount: { increment: 1 },
        lastWarningAt: new Date()
      }
    });

    await this.logModeration(userId, 'WARN', reason, { warnCount: user.warnCount });

    // Auto-ban after 5 warnings
    if (user.warnCount >= 5) {
      await this.autoBan(userId, 'Exceeded warning limit (5 warnings)');
    }

    return user.warnCount;
  }

  /**
   * Auto-ban a user
   */
  async autoBan(userId, reason) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: true,
        bannedAt: new Date(),
        bannedBy: 'SYSTEM',
        banReason: reason
      }
    });

    await this.logModeration(userId, 'BAN', reason, { autoModerated: true });

    console.log(`🔨 Auto-banned user ${userId}: ${reason}`);
  }

  /**
   * Log moderation action
   */
  async logModeration(userId, action, reason, details = {}) {
    try {
      await this.prisma.moderationLog.create({
        data: {
          userId,
          action,
          reason,
          details,
          autoModerated: true
        }
      });
    } catch (error) {
      console.error('Failed to log moderation:', error);
    }
  }

  /**
   * Save chat message to database
   */
  async saveChatMessage(userId, message, roomId, isFiltered = false, flagReason = null) {
    try {
      return await this.prisma.chatMessage.create({
        data: {
          userId,
          message,
          roomId,
          isFiltered,
          isFlagged: !!flagReason,
          flagReason
        }
      });
    } catch (error) {
      console.error('Failed to save chat message:', error);
      return null;
    }
  }
}

module.exports = { AutoModerationService };
