# Content Domain Map

Critical: The brain must distinguish between these content types.

## PortfolioItem

- **What**: Creator's portfolio work samples
- **Use for**: Brand deals, sponsored content, work history
- **Attributes**: brand, deliverables, metrics, media, date
- **Public**: Via shareable links

## Post

- **What**: Regular social posts
- **Use for**: Updates, announcements, engagement
- **Attributes**: content, media, engagement metrics
- **Public**: In discover feed, profile

## Insight

- **What**: Analytics or performance data
- **Use for**: Showing creators their stats
- **Attributes**: metrics, date range, comparisons

## Thread

- **What**: Multi-post conversational threads
- **Use for**: Daily engagement, stories equivalent
- **Attributes**: sequence of posts, timestamps

## ShareableLink

- **What**: Public profile/link for brand outreach
- **Use for**: Creator pitch pages, no-login required
- **Attributes**: token, creator info, view tracking

---

## Key Distinction Rules

- **Brand deal work** → PortfolioItem
- **Social posts** → Post
- **Daily/ephemeral** → Thread
- **Analytics display** → Insight
- **Public pitch page** → ShareableLink

> WARNING: Do not confuse these. Reusing the wrong domain creates schema pollution.
