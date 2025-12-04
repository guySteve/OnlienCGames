"use strict";
/**
 * VegasCore Syndicate Service
 *
 * Core business logic for the guild/syndicate system.
 * Handles treasury management, member roles, tax collection, and dividend distribution.
 *
 * Psychological Principles:
 * 1. Tribal Identity - "Us vs Them" mentality drives engagement
 * 2. Collective Investment - Shared treasury creates commitment
 * 3. Social Obligation - Members feel duty to contribute
 * 4. Status Hierarchy - Roles provide progression beyond individual levels
 */

const crypto = require('crypto');

// Constants
const MIN_SYNDICATE_NAME_LENGTH = 3;
const MAX_SYNDICATE_NAME_LENGTH = 30;
const MIN_TAG_LENGTH = 2;
const MAX_TAG_LENGTH = 6;
const DEFAULT_TAX_RATE = 0.01; // 1%
const BIG_WIN_THRESHOLD = 1000; // Minimum win to trigger tax
const MIN_TAX_AMOUNT = 10; // Floor for tax deduction
const MAX_MEMBERS_DEFAULT = 50;
const DIVIDEND_ELIGIBILITY_THRESHOLD = 100; // Minimum weekly contribution for dividends

class SyndicateService {
    constructor(prisma, redis, io) {
        this.prisma = prisma;
        this.redis = redis;
        this.io = io; // Socket.io instance for real-time updates
    }

    // =========================================================================
    // SYNDICATE LIFECYCLE
    // =========================================================================

    /**
     * Create a new syndicate
     * Cost: 5000 chips (burned from economy)
     */
    async createSyndicate(userId, name, tag, options = {}) {
        const CREATION_COST = 5000;

        // Validate inputs
        const cleanName = name.trim();
        const cleanTag = tag.trim().toUpperCase();

        if (cleanName.length < MIN_SYNDICATE_NAME_LENGTH || cleanName.length > MAX_SYNDICATE_NAME_LENGTH) {
            return { success: false, error: `Name must be ${MIN_SYNDICATE_NAME_LENGTH}-${MAX_SYNDICATE_NAME_LENGTH} characters` };
        }

        if (cleanTag.length < MIN_TAG_LENGTH || cleanTag.length > MAX_TAG_LENGTH) {
            return { success: false, error: `Tag must be ${MIN_TAG_LENGTH}-${MAX_TAG_LENGTH} characters` };
        }

        if (!/^[A-Z0-9]+$/.test(cleanTag)) {
            return { success: false, error: 'Tag can only contain letters and numbers' };
        }

        // Check user eligibility
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { syndicateMembership: true }
        });

        if (!user) {
            return { success: false, error: 'User not found' };
        }

        if (user.syndicateMembership) {
            return { success: false, error: 'You must leave your current syndicate first' };
        }

        if (user.chipBalance < CREATION_COST) {
            return { success: false, error: `Insufficient chips. Need ${CREATION_COST} chips to create a syndicate` };
        }

        // Check name/tag availability
        const existing = await this.prisma.syndicate.findFirst({
            where: {
                OR: [
                    { name: { equals: cleanName, mode: 'insensitive' } },
                    { tag: cleanTag }
                ]
            }
        });

        if (existing) {
            return { success: false, error: 'Syndicate name or tag already taken' };
        }

        // Create syndicate in transaction
        const result = await this.prisma.$transaction(async (tx) => {
            // Deduct creation cost
            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: {
                    chipBalance: { decrement: CREATION_COST }
                }
            });

            // Record transaction
            await tx.transaction.create({
                data: {
                    userId,
                    amount: -CREATION_COST,
                    type: 'ADMIN_DEBIT',
                    balanceBefore: user.chipBalance,
                    balanceAfter: updatedUser.chipBalance,
                    description: `Created syndicate: ${cleanName}`
                }
            });

            // Create syndicate
            const syndicate = await tx.syndicate.create({
                data: {
                    name: cleanName,
                    tag: cleanTag,
                    description: options.description || null,
                    iconUrl: options.iconUrl || null,
                    bannerUrl: options.bannerUrl || null,
                    isPublic: options.isPublic !== false,
                    minLevelToJoin: options.minLevelToJoin || 1,
                    maxMembers: options.maxMembers || MAX_MEMBERS_DEFAULT
                }
            });

            // Add creator as leader
            await tx.syndicateMember.create({
                data: {
                    syndicateId: syndicate.id,
                    userId,
                    role: 'LEADER'
                }
            });

            return { syndicate, user: updatedUser };
        });

        // Emit creation event
        await this.emitSyndicateEvent('syndicate_created', {
            syndicateId: result.syndicate.id,
            name: result.syndicate.name,
            tag: result.syndicate.tag,
            leaderId: userId
        });

        return {
            success: true,
            syndicate: result.syndicate,
            newBalance: result.user.chipBalance
        };
    }

    /**
     * Get syndicate details with member list
     */
    async getSyndicate(syndicateId, requestingUserId = null) {
        const syndicate = await this.prisma.syndicate.findUnique({
            where: { id: syndicateId },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                displayName: true,
                                nickname: true,
                                avatarUrl: true,
                                customAvatar: true,
                                xpLevel: true,
                                vipStatus: true
                            }
                        }
                    },
                    orderBy: [
                        { role: 'desc' },
                        { weeklyContribution: 'desc' }
                    ]
                }
            }
        });

        if (!syndicate) {
            return null;
        }

        // Calculate additional stats
        const weeklyLeader = syndicate.members.reduce((max, m) =>
            m.weeklyContribution > (max?.weeklyContribution || 0n) ? m : max, null);

        return {
            ...syndicate,
            weeklyLeader: weeklyLeader ? {
                userId: weeklyLeader.userId,
                name: weeklyLeader.user.nickname || weeklyLeader.user.displayName,
                contribution: weeklyLeader.weeklyContribution
            } : null,
            isRequestingUserMember: requestingUserId ?
                syndicate.members.some(m => m.userId === requestingUserId) : false
        };
    }

    /**
     * Search public syndicates
     */
    async searchSyndicates(query, options = {}) {
        const { page = 1, limit = 20, sortBy = 'weeklyXP' } = options;
        const skip = (page - 1) * limit;

        const where = {
            isPublic: true,
            ...(query && {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { tag: { contains: query.toUpperCase() } }
                ]
            })
        };

        const [syndicates, total] = await Promise.all([
            this.prisma.syndicate.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [sortBy]: 'desc' },
                include: {
                    members: {
                        where: { role: 'LEADER' },
                        include: {
                            user: {
                                select: { displayName: true, nickname: true }
                            }
                        }
                    },
                    _count: { select: { members: true } }
                }
            }),
            this.prisma.syndicate.count({ where })
        ]);

        return {
            syndicates: syndicates.map(s => ({
                id: s.id,
                name: s.name,
                tag: s.tag,
                description: s.description,
                iconUrl: s.iconUrl,
                memberCount: s._count.members,
                maxMembers: s.maxMembers,
                weeklyXP: s.weeklyXP,
                minLevelToJoin: s.minLevelToJoin,
                leader: s.members[0]?.user?.nickname || s.members[0]?.user?.displayName || 'Unknown'
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    // =========================================================================
    // MEMBERSHIP MANAGEMENT
    // =========================================================================

    /**
     * Join a public syndicate
     */
    async joinSyndicate(userId, syndicateId) {
        const [user, syndicate] = await Promise.all([
            this.prisma.user.findUnique({
                where: { id: userId },
                include: { syndicateMembership: true }
            }),
            this.prisma.syndicate.findUnique({
                where: { id: syndicateId },
                include: { _count: { select: { members: true } } }
            })
        ]);

        if (!user) return { success: false, error: 'User not found' };
        if (!syndicate) return { success: false, error: 'Syndicate not found' };
        if (user.syndicateMembership) return { success: false, error: 'You are already in a syndicate' };
        if (!syndicate.isPublic) return { success: false, error: 'This syndicate is invite-only' };
        if (user.xpLevel < syndicate.minLevelToJoin) {
            return { success: false, error: `Requires level ${syndicate.minLevelToJoin} to join` };
        }
        if (syndicate._count.members >= syndicate.maxMembers) {
            return { success: false, error: 'Syndicate is full' };
        }

        // Create membership
        const membership = await this.prisma.$transaction(async (tx) => {
            const member = await tx.syndicateMember.create({
                data: {
                    syndicateId,
                    userId,
                    role: 'MEMBER'
                }
            });

            await tx.syndicate.update({
                where: { id: syndicateId },
                data: { totalMembers: { increment: 1 } }
            });

            return member;
        });

        // Emit join event
        await this.emitSyndicateEvent('member_joined', {
            syndicateId,
            userId,
            userName: user.nickname || user.displayName
        });

        return { success: true, membership };
    }

    /**
     * Leave syndicate
     */
    async leaveSyndicate(userId) {
        const membership = await this.prisma.syndicateMember.findFirst({
            where: { userId },
            include: { syndicate: true }
        });

        if (!membership) {
            return { success: false, error: 'You are not in a syndicate' };
        }

        if (membership.role === 'LEADER') {
            // Check if there are other members
            const memberCount = await this.prisma.syndicateMember.count({
                where: { syndicateId: membership.syndicateId }
            });

            if (memberCount > 1) {
                return { success: false, error: 'Transfer leadership before leaving' };
            }

            // Dissolve syndicate if last member
            await this.dissolveSyndicate(membership.syndicateId);
            return { success: true, dissolved: true };
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.syndicateMember.delete({
                where: { id: membership.id }
            });

            await tx.syndicate.update({
                where: { id: membership.syndicateId },
                data: { totalMembers: { decrement: 1 } }
            });
        });

        await this.emitSyndicateEvent('member_left', {
            syndicateId: membership.syndicateId,
            userId
        });

        return { success: true };
    }

    /**
     * Transfer leadership
     */
    async transferLeadership(currentLeaderId, newLeaderId) {
        const currentMembership = await this.prisma.syndicateMember.findFirst({
            where: { userId: currentLeaderId }
        });

        if (!currentMembership || currentMembership.role !== 'LEADER') {
            return { success: false, error: 'You are not the syndicate leader' };
        }

        const newLeaderMembership = await this.prisma.syndicateMember.findFirst({
            where: {
                syndicateId: currentMembership.syndicateId,
                userId: newLeaderId
            }
        });

        if (!newLeaderMembership) {
            return { success: false, error: 'New leader must be a syndicate member' };
        }

        await this.prisma.$transaction([
            this.prisma.syndicateMember.update({
                where: { id: currentMembership.id },
                data: { role: 'OFFICER' }
            }),
            this.prisma.syndicateMember.update({
                where: { id: newLeaderMembership.id },
                data: { role: 'LEADER' }
            })
        ]);

        await this.emitSyndicateEvent('leadership_transferred', {
            syndicateId: currentMembership.syndicateId,
            oldLeaderId: currentLeaderId,
            newLeaderId
        });

        return { success: true };
    }

    /**
     * Promote/demote member
     */
    async setMemberRole(leaderId, targetUserId, newRole) {
        const leaderMembership = await this.prisma.syndicateMember.findFirst({
            where: { userId: leaderId }
        });

        if (!leaderMembership || leaderMembership.role !== 'LEADER') {
            return { success: false, error: 'Only the leader can change roles' };
        }

        if (newRole === 'LEADER') {
            return { success: false, error: 'Use transferLeadership to change leaders' };
        }

        const targetMembership = await this.prisma.syndicateMember.findFirst({
            where: {
                syndicateId: leaderMembership.syndicateId,
                userId: targetUserId
            }
        });

        if (!targetMembership) {
            return { success: false, error: 'User is not a member of this syndicate' };
        }

        if (targetMembership.role === 'LEADER') {
            return { success: false, error: 'Cannot demote the leader' };
        }

        await this.prisma.syndicateMember.update({
            where: { id: targetMembership.id },
            data: { role: newRole }
        });

        return { success: true };
    }

    /**
     * Kick member from syndicate
     */
    async kickMember(leaderId, targetUserId) {
        const leaderMembership = await this.prisma.syndicateMember.findFirst({
            where: { userId: leaderId }
        });

        if (!leaderMembership || !['LEADER', 'OFFICER'].includes(leaderMembership.role)) {
            return { success: false, error: 'Insufficient permissions' };
        }

        const targetMembership = await this.prisma.syndicateMember.findFirst({
            where: {
                syndicateId: leaderMembership.syndicateId,
                userId: targetUserId
            }
        });

        if (!targetMembership) {
            return { success: false, error: 'User is not a member' };
        }

        // Officers can't kick other officers or leader
        if (leaderMembership.role === 'OFFICER' && targetMembership.role !== 'MEMBER') {
            return { success: false, error: 'Officers can only kick regular members' };
        }

        if (targetMembership.role === 'LEADER') {
            return { success: false, error: 'Cannot kick the leader' };
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.syndicateMember.delete({
                where: { id: targetMembership.id }
            });

            await tx.syndicate.update({
                where: { id: leaderMembership.syndicateId },
                data: { totalMembers: { decrement: 1 } }
            });
        });

        await this.emitSyndicateEvent('member_kicked', {
            syndicateId: leaderMembership.syndicateId,
            kickedUserId: targetUserId,
            kickedBy: leaderId
        });

        return { success: true };
    }

    /**
     * Dissolve syndicate (leader only, when last member)
     */
    async dissolveSyndicate(syndicateId) {
        // Return any remaining treasury to... nowhere (burned)
        // This incentivizes distributing before dissolving
        await this.prisma.syndicate.delete({
            where: { id: syndicateId }
        });

        await this.emitSyndicateEvent('syndicate_dissolved', { syndicateId });

        return { success: true };
    }

    // =========================================================================
    // TREASURY MANAGEMENT - THE HEART OF TRIBAL ECONOMICS
    // =========================================================================

    /**
     * Process treasury tax on big wins
     * Called by GameEngine after awarding chips
     *
     * Tax Rate: 1% of wins >= 1000 chips (minimum 10 chip tax)
     */
    async processTreasuryTax(userId, winAmount, gameType, gameSessionId) {
        if (winAmount < BIG_WIN_THRESHOLD) {
            return { taxed: false, reason: 'Win below threshold' };
        }

        const membership = await this.prisma.syndicateMember.findFirst({
            where: { userId },
            include: { syndicate: true }
        });

        if (!membership) {
            return { taxed: false, reason: 'Not in syndicate' };
        }

        const syndicate = membership.syndicate;
        const taxAmount = Math.max(
            MIN_TAX_AMOUNT,
            Math.floor(winAmount * syndicate.taxRate)
        );

        const result = await this.prisma.$transaction(async (tx) => {
            // Deduct from player
            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: {
                    chipBalance: { decrement: taxAmount }
                }
            });

            // Record player transaction
            await tx.transaction.create({
                data: {
                    userId,
                    amount: -taxAmount,
                    type: 'TIP', // Reusing TIP type for syndicate contributions
                    balanceBefore: BigInt(updatedUser.chipBalance) + BigInt(taxAmount),
                    balanceAfter: updatedUser.chipBalance,
                    gameSessionId,
                    description: `Syndicate Treasury Tax (${(syndicate.taxRate * 100).toFixed(1)}%)`,
                    metadata: {
                        syndicateId: syndicate.id,
                        syndicateName: syndicate.name,
                        originalWin: winAmount
                    }
                }
            });

            // Credit to syndicate treasury
            const updatedSyndicate = await tx.syndicate.update({
                where: { id: syndicate.id },
                data: {
                    treasuryBalance: { increment: taxAmount },
                    lifetimeEarnings: { increment: taxAmount },
                    totalWins: { increment: 1 }
                }
            });

            // Record syndicate transaction
            await tx.syndicateTransaction.create({
                data: {
                    syndicateId: syndicate.id,
                    userId,
                    amount: BigInt(taxAmount),
                    type: 'TAX_CONTRIBUTION',
                    balanceBefore: syndicate.treasuryBalance,
                    balanceAfter: updatedSyndicate.treasuryBalance,
                    description: `Tax from ${gameType} win`,
                    metadata: {
                        originalWin: winAmount,
                        gameSessionId
                    }
                }
            });

            // Update member contribution tracking
            await tx.syndicateMember.update({
                where: { id: membership.id },
                data: {
                    contributedChips: { increment: taxAmount },
                    weeklyContribution: { increment: taxAmount },
                    gamesPlayed: { increment: 1 },
                    lastActive: new Date()
                }
            });

            return { updatedUser, updatedSyndicate };
        });

        // Real-time notification to syndicate members
        await this.emitSyndicateEvent('treasury_contribution', {
            syndicateId: syndicate.id,
            contributorId: userId,
            amount: taxAmount,
            newBalance: Number(result.updatedSyndicate.treasuryBalance),
            gameType
        });

        // Cache updated balance for quick access
        await this.redis.setex(
            `syndicate:${syndicate.id}:treasury`,
            300, // 5 min cache
            result.updatedSyndicate.treasuryBalance.toString()
        );

        return {
            taxed: true,
            amount: taxAmount,
            newTreasury: result.updatedSyndicate.treasuryBalance,
            newPlayerBalance: result.updatedUser.chipBalance
        };
    }

    /**
     * Manual donation to treasury
     */
    async donateToTreasury(userId, amount) {
        if (amount < 1) {
            return { success: false, error: 'Minimum donation is 1 chip' };
        }

        const membership = await this.prisma.syndicateMember.findFirst({
            where: { userId },
            include: { syndicate: true, user: true }
        });

        if (!membership) {
            return { success: false, error: 'You are not in a syndicate' };
        }

        if (membership.user.chipBalance < amount) {
            return { success: false, error: 'Insufficient chips' };
        }

        const result = await this.prisma.$transaction(async (tx) => {
            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: { chipBalance: { decrement: amount } }
            });

            await tx.transaction.create({
                data: {
                    userId,
                    amount: -amount,
                    type: 'TIP',
                    balanceBefore: membership.user.chipBalance,
                    balanceAfter: updatedUser.chipBalance,
                    description: `Donation to ${membership.syndicate.name} treasury`
                }
            });

            const updatedSyndicate = await tx.syndicate.update({
                where: { id: membership.syndicateId },
                data: {
                    treasuryBalance: { increment: amount },
                    lifetimeEarnings: { increment: amount }
                }
            });

            await tx.syndicateTransaction.create({
                data: {
                    syndicateId: membership.syndicateId,
                    userId,
                    amount: BigInt(amount),
                    type: 'MANUAL_DONATION',
                    balanceBefore: membership.syndicate.treasuryBalance,
                    balanceAfter: updatedSyndicate.treasuryBalance,
                    description: 'Voluntary donation'
                }
            });

            await tx.syndicateMember.update({
                where: { id: membership.id },
                data: {
                    contributedChips: { increment: amount },
                    weeklyContribution: { increment: amount }
                }
            });

            return { updatedUser, updatedSyndicate };
        });

        await this.emitSyndicateEvent('donation_received', {
            syndicateId: membership.syndicateId,
            donorId: userId,
            amount,
            newBalance: Number(result.updatedSyndicate.treasuryBalance)
        });

        return {
            success: true,
            newPlayerBalance: result.updatedUser.chipBalance,
            newTreasury: result.updatedSyndicate.treasuryBalance
        };
    }

    /**
     * Leader withdrawal from treasury (for events, prizes, etc.)
     */
    async withdrawFromTreasury(leaderId, amount, reason) {
        const membership = await this.prisma.syndicateMember.findFirst({
            where: { userId: leaderId },
            include: { syndicate: true }
        });

        if (!membership || membership.role !== 'LEADER') {
            return { success: false, error: 'Only the leader can withdraw' };
        }

        if (membership.syndicate.treasuryBalance < amount) {
            return { success: false, error: 'Insufficient treasury balance' };
        }

        const result = await this.prisma.$transaction(async (tx) => {
            const updatedSyndicate = await tx.syndicate.update({
                where: { id: membership.syndicateId },
                data: { treasuryBalance: { decrement: amount } }
            });

            const updatedUser = await tx.user.update({
                where: { id: leaderId },
                data: { chipBalance: { increment: amount } }
            });

            await tx.syndicateTransaction.create({
                data: {
                    syndicateId: membership.syndicateId,
                    userId: leaderId,
                    amount: BigInt(-amount),
                    type: 'LEADER_WITHDRAWAL',
                    balanceBefore: membership.syndicate.treasuryBalance,
                    balanceAfter: updatedSyndicate.treasuryBalance,
                    description: reason || 'Leader withdrawal'
                }
            });

            await tx.transaction.create({
                data: {
                    userId: leaderId,
                    amount,
                    type: 'TRANSFER_RECEIVED',
                    balanceBefore: BigInt(updatedUser.chipBalance) - BigInt(amount),
                    balanceAfter: updatedUser.chipBalance,
                    description: `Withdrawal from ${membership.syndicate.name} treasury`
                }
            });

            return { updatedSyndicate, updatedUser };
        });

        await this.emitSyndicateEvent('treasury_withdrawal', {
            syndicateId: membership.syndicateId,
            leaderId,
            amount,
            reason,
            newBalance: Number(result.updatedSyndicate.treasuryBalance)
        });

        return {
            success: true,
            newTreasury: result.updatedSyndicate.treasuryBalance,
            newLeaderBalance: result.updatedUser.chipBalance
        };
    }

    // =========================================================================
    // DIVIDEND DISTRIBUTION - WEEKLY PAYOUTS
    // =========================================================================

    /**
     * Distribute weekly dividends to eligible members
     * Called by cron job every Sunday at midnight
     *
     * Eligibility: Members with >= DIVIDEND_ELIGIBILITY_THRESHOLD weekly contribution
     * Distribution: Equal split among eligible members (50% of treasury)
     */
    async distributeDividends(syndicateId) {
        const syndicate = await this.prisma.syndicate.findUnique({
            where: { id: syndicateId },
            include: {
                members: {
                    include: {
                        user: {
                            select: { id: true, displayName: true, nickname: true, chipBalance: true }
                        }
                    }
                }
            }
        });

        if (!syndicate) {
            return { success: false, error: 'Syndicate not found' };
        }

        // Filter eligible members
        const eligibleMembers = syndicate.members.filter(
            m => m.weeklyContribution >= DIVIDEND_ELIGIBILITY_THRESHOLD
        );

        if (eligibleMembers.length === 0) {
            return { success: false, error: 'No eligible members for dividend' };
        }

        // Calculate distribution (50% of treasury)
        const distributionPool = BigInt(Math.floor(Number(syndicate.treasuryBalance) * 0.5));

        if (distributionPool < eligibleMembers.length) {
            return { success: false, error: 'Insufficient treasury for distribution' };
        }

        const amountPerMember = distributionPool / BigInt(eligibleMembers.length);
        const totalDistributed = amountPerMember * BigInt(eligibleMembers.length);

        const now = new Date();
        const periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() - 7);

        const result = await this.prisma.$transaction(async (tx) => {
            // Deduct from treasury
            const updatedSyndicate = await tx.syndicate.update({
                where: { id: syndicateId },
                data: { treasuryBalance: { decrement: totalDistributed } }
            });

            // Record syndicate dividend
            const dividend = await tx.syndicateDividend.create({
                data: {
                    syndicateId,
                    totalAmount: totalDistributed,
                    memberCount: eligibleMembers.length,
                    amountPerMember,
                    periodStart,
                    periodEnd: now,
                    metadata: {
                        recipients: eligibleMembers.map(m => ({
                            userId: m.userId,
                            contribution: Number(m.weeklyContribution),
                            amount: Number(amountPerMember)
                        }))
                    }
                }
            });

            // Credit each eligible member
            for (const member of eligibleMembers) {
                const memberAmount = Number(amountPerMember);

                await tx.user.update({
                    where: { id: member.userId },
                    data: { chipBalance: { increment: memberAmount } }
                });

                await tx.transaction.create({
                    data: {
                        userId: member.userId,
                        amount: memberAmount,
                        type: 'TRANSFER_RECEIVED',
                        balanceBefore: member.user.chipBalance,
                        balanceAfter: BigInt(member.user.chipBalance) + BigInt(memberAmount),
                        description: `${syndicate.name} weekly dividend`,
                        metadata: {
                            syndicateId,
                            dividendId: dividend.id,
                            weeklyContribution: Number(member.weeklyContribution)
                        }
                    }
                });

                await tx.syndicateMember.update({
                    where: { id: member.id },
                    data: {
                        dividendsReceived: { increment: memberAmount }
                    }
                });
            }

            // Record treasury transaction
            await tx.syndicateTransaction.create({
                data: {
                    syndicateId,
                    amount: -totalDistributed,
                    type: 'DIVIDEND_PAYOUT',
                    balanceBefore: syndicate.treasuryBalance,
                    balanceAfter: updatedSyndicate.treasuryBalance,
                    description: `Weekly dividend to ${eligibleMembers.length} members`,
                    metadata: { dividendId: dividend.id }
                }
            });

            // Reset weekly contributions
            await tx.syndicateMember.updateMany({
                where: { syndicateId },
                data: { weeklyContribution: 0 }
            });

            // Reset weekly XP
            await tx.syndicate.update({
                where: { id: syndicateId },
                data: { weeklyXP: 0 }
            });

            return { dividend, updatedSyndicate };
        });

        // Notify all members
        await this.emitSyndicateEvent('dividend_distributed', {
            syndicateId,
            totalAmount: Number(totalDistributed),
            memberCount: eligibleMembers.length,
            amountPerMember: Number(amountPerMember)
        });

        return {
            success: true,
            dividend: result.dividend,
            newTreasury: result.updatedSyndicate.treasuryBalance,
            eligibleMembers: eligibleMembers.length,
            amountPerMember: Number(amountPerMember)
        };
    }

    /**
     * Get dividend history for a syndicate
     */
    async getDividendHistory(syndicateId, limit = 10) {
        return this.prisma.syndicateDividend.findMany({
            where: { syndicateId },
            orderBy: { createdAt: 'desc' },
            take: limit
        });
    }

    // =========================================================================
    // SYNDICATE INVITES
    // =========================================================================

    /**
     * Invite user to syndicate
     */
    async inviteToSyndicate(inviterId, inviteeId) {
        const inviterMembership = await this.prisma.syndicateMember.findFirst({
            where: { userId: inviterId },
            include: { syndicate: true }
        });

        if (!inviterMembership || !['LEADER', 'OFFICER'].includes(inviterMembership.role)) {
            return { success: false, error: 'Only leaders and officers can invite' };
        }

        const invitee = await this.prisma.user.findUnique({
            where: { id: inviteeId },
            include: { syndicateMembership: true }
        });

        if (!invitee) {
            return { success: false, error: 'User not found' };
        }

        if (invitee.syndicateMembership) {
            return { success: false, error: 'User is already in a syndicate' };
        }

        // Check for existing pending invite
        const existingInvite = await this.prisma.syndicateInvite.findFirst({
            where: {
                syndicateId: inviterMembership.syndicateId,
                toUserId: inviteeId,
                status: 'PENDING'
            }
        });

        if (existingInvite) {
            return { success: false, error: 'Invite already pending' };
        }

        const invite = await this.prisma.syndicateInvite.create({
            data: {
                syndicateId: inviterMembership.syndicateId,
                fromUserId: inviterId,
                toUserId: inviteeId,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            }
        });

        // Notify invitee via socket
        if (this.io) {
            this.io.to(`user:${inviteeId}`).emit('syndicate_invite', {
                inviteId: invite.id,
                syndicateName: inviterMembership.syndicate.name,
                syndicateTag: inviterMembership.syndicate.tag,
                inviterName: inviterMembership.user?.displayName
            });
        }

        return { success: true, invite };
    }

    /**
     * Accept syndicate invite
     */
    async acceptInvite(userId, inviteId) {
        const invite = await this.prisma.syndicateInvite.findUnique({
            where: { id: inviteId },
            include: { syndicate: true }
        });

        if (!invite || invite.toUserId !== userId) {
            return { success: false, error: 'Invite not found' };
        }

        if (invite.status !== 'PENDING') {
            return { success: false, error: 'Invite is no longer valid' };
        }

        if (invite.expiresAt < new Date()) {
            await this.prisma.syndicateInvite.update({
                where: { id: inviteId },
                data: { status: 'EXPIRED' }
            });
            return { success: false, error: 'Invite has expired' };
        }

        // Check if syndicate is full
        const memberCount = await this.prisma.syndicateMember.count({
            where: { syndicateId: invite.syndicateId }
        });

        if (memberCount >= invite.syndicate.maxMembers) {
            return { success: false, error: 'Syndicate is full' };
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.syndicateInvite.update({
                where: { id: inviteId },
                data: { status: 'ACCEPTED' }
            });

            await tx.syndicateMember.create({
                data: {
                    syndicateId: invite.syndicateId,
                    userId,
                    role: 'MEMBER'
                }
            });

            await tx.syndicate.update({
                where: { id: invite.syndicateId },
                data: { totalMembers: { increment: 1 } }
            });
        });

        await this.emitSyndicateEvent('member_joined', {
            syndicateId: invite.syndicateId,
            userId,
            viaInvite: true
        });

        return { success: true };
    }

    /**
     * Decline syndicate invite
     */
    async declineInvite(userId, inviteId) {
        const invite = await this.prisma.syndicateInvite.findUnique({
            where: { id: inviteId }
        });

        if (!invite || invite.toUserId !== userId) {
            return { success: false, error: 'Invite not found' };
        }

        await this.prisma.syndicateInvite.update({
            where: { id: inviteId },
            data: { status: 'DECLINED' }
        });

        return { success: true };
    }

    /**
     * Get pending invites for user
     */
    async getPendingInvites(userId) {
        return this.prisma.syndicateInvite.findMany({
            where: {
                toUserId: userId,
                status: 'PENDING',
                expiresAt: { gt: new Date() }
            },
            include: {
                syndicate: {
                    select: {
                        id: true,
                        name: true,
                        tag: true,
                        iconUrl: true,
                        totalMembers: true
                    }
                }
            }
        });
    }

    // =========================================================================
    // LEADERBOARDS & RANKINGS
    // =========================================================================

    /**
     * Get syndicate leaderboard
     */
    async getSyndicateLeaderboard(sortBy = 'weeklyXP', limit = 50) {
        const validSorts = ['weeklyXP', 'lifetimeEarnings', 'totalMembers', 'totalWins'];
        const orderField = validSorts.includes(sortBy) ? sortBy : 'weeklyXP';

        return this.prisma.syndicate.findMany({
            take: limit,
            orderBy: { [orderField]: 'desc' },
            select: {
                id: true,
                name: true,
                tag: true,
                iconUrl: true,
                [orderField]: true,
                totalMembers: true,
                _count: { select: { members: true } }
            }
        });
    }

    /**
     * Get member contribution leaderboard within syndicate
     */
    async getMemberLeaderboard(syndicateId, period = 'weekly', limit = 20) {
        const orderField = period === 'weekly' ? 'weeklyContribution' : 'contributedChips';

        return this.prisma.syndicateMember.findMany({
            where: { syndicateId },
            take: limit,
            orderBy: { [orderField]: 'desc' },
            include: {
                user: {
                    select: {
                        id: true,
                        displayName: true,
                        nickname: true,
                        avatarUrl: true,
                        customAvatar: true
                    }
                }
            }
        });
    }

    // =========================================================================
    // UTILITY METHODS
    // =========================================================================

    /**
     * Get user's syndicate membership
     */
    async getUserSyndicate(userId) {
        const membership = await this.prisma.syndicateMember.findFirst({
            where: { userId },
            include: {
                syndicate: {
                    include: {
                        members: {
                            take: 5,
                            orderBy: { weeklyContribution: 'desc' },
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        displayName: true,
                                        nickname: true,
                                        avatarUrl: true,
                                        customAvatar: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        return membership;
    }

    /**
     * Emit syndicate-specific socket event
     */
    async emitSyndicateEvent(eventType, data) {
        if (!this.io) return;

        // Emit to syndicate room
        if (data.syndicateId) {
            this.io.to(`syndicate:${data.syndicateId}`).emit(eventType, data);
        }

        // Also push to Redis for persistence/recovery
        if (this.redis) {
            const eventKey = `syndicate:${data.syndicateId}:events`;
            await this.redis.lpush(eventKey, JSON.stringify({
                type: eventType,
                data,
                timestamp: Date.now()
            }));
            await this.redis.ltrim(eventKey, 0, 49); // Keep last 50 events
            await this.redis.expire(eventKey, 86400); // 24 hour TTL
        }
    }

    /**
     * Update syndicate settings
     */
    async updateSettings(leaderId, settings) {
        const membership = await this.prisma.syndicateMember.findFirst({
            where: { userId: leaderId }
        });

        if (!membership || membership.role !== 'LEADER') {
            return { success: false, error: 'Only the leader can update settings' };
        }

        const allowedFields = ['description', 'iconUrl', 'bannerUrl', 'isPublic', 'minLevelToJoin', 'taxRate'];
        const updates = {};

        for (const field of allowedFields) {
            if (settings[field] !== undefined) {
                if (field === 'taxRate') {
                    // Validate tax rate (0-5%)
                    const rate = parseFloat(settings[field]);
                    if (isNaN(rate) || rate < 0 || rate > 0.05) {
                        return { success: false, error: 'Tax rate must be 0-5%' };
                    }
                    updates[field] = rate;
                } else {
                    updates[field] = settings[field];
                }
            }
        }

        const syndicate = await this.prisma.syndicate.update({
            where: { id: membership.syndicateId },
            data: updates
        });

        return { success: true, syndicate };
    }
}

// Singleton instance
let syndicateService = null;

function initSyndicateService(prisma, redis, io) {
    syndicateService = new SyndicateService(prisma, redis, io);
    return syndicateService;
}

function getSyndicateService() {
    if (!syndicateService) {
        throw new Error('SyndicateService not initialized. Call initSyndicateService first.');
    }
    return syndicateService;
}

module.exports = {
    SyndicateService,
    initSyndicateService,
    getSyndicateService
};
