# 🎯 SEO QUICK REFERENCE GUIDE

## 📍 What's Live Right Now

### Pages Created
| URL | Purpose | Status | Word Count |
|-----|---------|--------|------------|
| `/` | Homepage | ✅ Optimized | - |
| `/welcome.html` | Landing page | ✅ Optimized | - |
| `/legal` | Legal terms | ✅ Complete | 2,000+ |
| `/how-it-works` | Guide | ✅ Complete | 2,500+ |
| `/responsible-gaming` | Health info | ✅ Complete | 2,200+ |
| `/casino-war` | Pillar page | ✅ Complete | 3,000+ |
| `/robots.txt` | Search rules | ✅ Active | - |
| `/sitemap.xml` | Site map | ✅ Active | - |

### Access URLs (Localhost)
- Homepage: http://localhost:3000/
- Welcome: http://localhost:3000/welcome.html
- Casino War Guide: http://localhost:3000/casino-war
- Legal: http://localhost:3000/legal
- How It Works: http://localhost:3000/how-it-works
- Responsible Gaming: http://localhost:3000/responsible-gaming
- Robots.txt: http://localhost:3000/robots.txt
- Sitemap: http://localhost:3000/sitemap.xml

---

## 🎨 Key SEO Elements on Every Page

### Must-Have Tags
```html
<!-- Title (50-60 characters) -->
<title>Free Online Poker with Friends | Moe's Card Room</title>

<!-- Meta Description (150-160 characters) -->
<meta name="description" content="Play free poker, blackjack & casino war with friends. No downloads, no real money, 100% social gaming.">

<!-- Canonical URL -->
<link rel="canonical" href="https://playwar.games/page-name">

<!-- Robots -->
<meta name="robots" content="index, follow">
```

### Schema Markup Templates

**Article Schema (for guides):**
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Your Page Title",
  "description": "Brief description",
  "image": "https://playwar.games/image.jpg",
  "datePublished": "2024-12-07",
  "author": {
    "@type": "Organization",
    "name": "Moe's Card Room"
  }
}
```

**FAQPage Schema (for Q&A sections):**
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "Your question here?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Your answer here."
    }
  }]
}
```

**HowTo Schema (for tutorials):**
```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Play Poker",
  "step": [{
    "@type": "HowToStep",
    "name": "Step 1",
    "text": "Description of step 1"
  }]
}
```

---

## ✍️ Content Writing Formula

### Pillar Page Structure (2,500-4,000 words)
1. **H1 Title** - Include primary keyword
2. **Meta Description** - 150-160 chars with CTA
3. **Introduction Paragraph** - What, why, who (200 words)
4. **Table of Contents** - Internal anchor links
5. **Main Content Sections** - Each with H2 heading
6. **FAQ Section** - 5-10 common questions
7. **CTA Section** - "Play Now" button
8. **Internal Links** - Link to 3-5 related pages
9. **Footer** - Standard disclaimer footer

### Spoke Article Structure (1,500-2,500 words)
1. **H1 Title** - Long-tail keyword
2. **Introduction** - 100-150 words
3. **3-5 Main Sections** - H2 headings
4. **Lists & Tables** - Break up text
5. **Internal Links** - Link back to pillar page + 2-3 related articles
6. **CTA** - Link to play or pillar page

---

## 🚫 Gambling Language to AVOID

### ❌ Never Use:
- "Win big money"
- "Jackpot"
- "Cash prizes"
- "Real money gambling"
- "Best online casino"
- "Deposit bonus"
- "Withdraw winnings"
- "Betting strategy to win cash"
- "Sports betting"
- "Casino bonuses"

### ✅ Always Use:
- "Play money chips"
- "Social gaming"
- "Free chips"
- "Entertainment only"
- "Practice poker"
- "Learn card game strategy"
- "Play with friends online"
- "No real money"
- "100% free"

---

## 📊 Monthly SEO Tasks

### Week 1: Content Creation
- [ ] Write 2 new articles (1 pillar, 1 spoke)
- [ ] Optimize images (WebP, <100KB, alt text)
- [ ] Add schema markup to new pages
- [ ] Update sitemap.xml with new URLs

### Week 2: Technical Audit
- [ ] Check Google Search Console for errors
- [ ] Run PageSpeed Insights on 5 pages
- [ ] Fix any broken internal links
- [ ] Review Core Web Vitals

### Week 3: Link Building
- [ ] Send 10 outreach emails
- [ ] Post in 5 Reddit/forum discussions
- [ ] Check HARO for opportunities
- [ ] Update old content with new internal links

### Week 4: Analytics Review
- [ ] Review organic traffic growth
- [ ] Check keyword rankings (top 20)
- [ ] Analyze top-performing pages
- [ ] Identify new keyword opportunities

---

## 🔗 Internal Linking Strategy

### Hub-and-Spoke Model
```
Homepage (/)
    ├── Poker Hub (/poker)
    │   ├── Hand Rankings (/poker/hand-rankings)
    │   ├── Texas Hold'em Rules (/poker/texas-holdem-rules)
    │   └── Strategy Guide (/poker/strategy)
    │
    ├── Blackjack Hub (/blackjack)
    │   ├── Basic Rules (/blackjack/rules)
    │   ├── Basic Strategy (/blackjack/basic-strategy)
    │   └── Card Counting Myths (/blackjack/card-counting)
    │
    └── Casino War Hub (/casino-war) ✅ DONE
        ├── Strategy Guide (/casino-war/strategy)
        └── History (/casino-war/history)
```

### Anchor Text Examples
**Good (Natural):**
- "Learn how to play poker"
- "Check out our blackjack strategy guide"
- "Read our complete casino war rules"

**Bad (Over-optimized):**
- "free online poker"
- "best blackjack strategy"
- "casino war online free"

---

## 🎯 Target Keywords by Priority

### Primary Keywords (High Priority)
1. `free online poker with friends` (590/mo, KD: 15)
2. `play blackjack online free` (1.2K/mo, KD: 22)
3. `casino war online free` (210/mo, KD: 8)
4. `play money poker` (480/mo, KD: 18)
5. `free card games with friends` (820/mo, KD: 12)

### Secondary Keywords (Medium Priority)
6. `how to play poker for beginners` (9.1K/mo, KD: 35)
7. `blackjack rules simple` (2.4K/mo, KD: 28)
8. `poker hand rankings` (33K/mo, KD: 42)
9. `social casino games` (1.5K/mo, KD: 25)
10. `online card games no download` (640/mo, KD: 18)

### Long-Tail Keywords (Quick Wins)
11. `free poker room no registration` (140/mo, KD: 5)
12. `play blackjack with friends online` (320/mo, KD: 10)
13. `casino war card game rules` (180/mo, KD: 8)
14. `how to play texas holdem step by step` (260/mo, KD: 12)
15. `social gaming platform free` (95/mo, KD: 6)

---

## 📧 Outreach Email Templates

### Resource Page Outreach
```
Subject: Free Poker Resource for [Website Name]

Hi [Name],

I came across your poker resources page and loved your collection of beginner guides.

I recently published a comprehensive guide to playing poker online for free that might fit well with your other resources: [URL]

It covers:
- Complete Texas Hold'em rules
- Hand rankings with visual chart
- Strategy tips for beginners
- No real money - pure social play

Would you consider adding it to your resource list?

Either way, great work on [Website Name]!

Best,
[Your Name]
```

### Broken Link Building
```
Subject: Broken link on [Page Name]

Hi [Name],

I was reading your article on [Topic] and noticed the link to [Dead Site] is no longer working.

I have a similar resource that might work as a replacement: [Your URL]

It covers [same topic] with [unique value].

Hope this helps!

Best,
[Your Name]
```

---

## ✅ Pre-Publish Checklist

Before publishing any new page:

### SEO Elements
- [ ] Title tag (50-60 chars, keyword at start)
- [ ] Meta description (150-160 chars, includes CTA)
- [ ] Canonical tag pointing to self
- [ ] H1 heading (one per page, includes keyword)
- [ ] 3+ H2 subheadings
- [ ] Schema markup (Article/HowTo/FAQ)
- [ ] 3+ internal links to related pages
- [ ] 1-2 external links to authority sites

### Content Quality
- [ ] 1,500+ words (pillar: 2,500+)
- [ ] Original content (not copied)
- [ ] Readability: 8th grade level or lower
- [ ] Lists or tables to break up text
- [ ] Images with alt text
- [ ] Clear CTA (button or link)

### Technical
- [ ] Mobile-friendly (responsive design)
- [ ] Images optimized (<100KB each)
- [ ] No broken links
- [ ] Loads in <3 seconds
- [ ] Footer disclaimer included
- [ ] Added to sitemap.xml

---

## 🚀 Quick Win Actions (Do Today)

1. **Submit Sitemap to Google Search Console**
   - Go to search.google.com/search-console
   - Add property: playwar.games
   - Verify ownership (DNS or HTML file)
   - Submit sitemap: https://playwar.games/sitemap.xml

2. **Install Google Analytics 4**
   - Go to analytics.google.com
   - Create property
   - Add tracking code to `<head>` of all pages
   - Test with Google Tag Assistant

3. **Create Next Pillar Page**
   - Choose: Poker or Blackjack
   - Research keywords with Ubersuggest
   - Write 2,500+ words
   - Add schema markup
   - Publish and add to sitemap

4. **Send First Outreach Email**
   - Find 1 poker resource page
   - Personalize template above
   - Send email
   - Track response in spreadsheet

5. **Engage on Reddit**
   - Join r/poker or r/casualgaming
   - Comment on 3 posts (add value, don't promote)
   - Share your guide if relevant (1 per week max)

---

## 📞 Support

**Questions about SEO implementation?**
- Review `/SEO_IMPLEMENTATION_COMPLETE.md` for full details
- Check Google Search Central for algorithm updates
- Use Ahrefs blog for tutorials

**Server Status:** ✅ Running on localhost:3000
**Production URL:** https://playwar.games (when deployed)

---

**Last Updated:** December 7, 2024
**Phase Completed:** 1 of 3 (Foundation)
**Next Phase:** Content Scaling (Poker & Blackjack pillar pages)
