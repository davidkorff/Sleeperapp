# Sleeper Fantasy Trade Analyzer

A smart trade analyzer for Sleeper fantasy football that evaluates trades based on **actual playable scenarios**, not just raw point totals.

## Why This Tool?

Traditional trade analyzers simply compare the total points of players involved. This tool is smarter - it recognizes that in fantasy football:

- **Roster spots are limited** - Trading 2 players for 3 might give you more total points, but you'll have to bench someone
- **Only starters count** - The analyzer optimizes your entire starting lineup before and after the trade
- **Position constraints matter** - It respects your league's roster configuration (QB, RB, WR, TE, FLEX, etc.)

## Features

- **Smart Lineup Optimization** - Automatically sets the best possible lineup given your roster positions
- **Accurate Point Projections** - Uses Sleeper's API to fetch real player projections
- **Side-by-Side Comparison** - See your lineup before and after the trade
- **Clear Recommendations** - Get instant feedback on whether to accept or decline
- **Support for All Formats** - Works with PPR, Half-PPR, Standard, and custom scoring
- **FLEX Position Handling** - Properly optimizes FLEX, SUPER_FLEX, and REC_FLEX positions
- **One-Click Login** - Save your Sleeper username and auto-load your leagues
- **Session Persistence** - Stay logged in across browser sessions

## Live Demo

Visit the hosted version at: **[Your Vercel URL]** (see [DEPLOYMENT.md](DEPLOYMENT.md) for deployment instructions)

## How to Use

### 1. Login with Your Sleeper Username

1. Visit the app (either locally or deployed version)
2. Enter your Sleeper username
3. Click "Continue to Analyzer"
4. Your leagues will automatically load

**Note:** Your username is verified against the Sleeper API and stored locally in your browser. We never send your data anywhere.

### 2. Select Your League

1. Choose one of your leagues from the dropdown
2. Select the week you want to analyze (1-18)
3. Click "Load Selected League"

### 3. Set Up the Trade

- **Left Column (Trading Away)** - Select players you would give up
- **Right Column (Trading For)** - Select players you would receive
- Click "+ Add Player" to add more players to either side

### 5. Analyze

Click "Analyze Trade" to see:
- Your optimal lineup without the trade
- Your optimal lineup with the trade
- The point difference
- A clear recommendation (Accept/Decline)

## How It Works

### The Smart Algorithm

1. **Fetches Your Roster** - Pulls all players on your team
2. **Gets Projections** - Retrieves point projections for the selected week
3. **Simulates Trade** - Creates a new roster with traded players swapped
4. **Optimizes Both Lineups** - Uses a greedy algorithm to set the best possible lineup for each scenario
5. **Compares Points** - Shows you the actual point difference between scenarios

### Lineup Optimization

The optimizer:
1. Fills required positions first (QB, RB, WR, TE, K, DEF)
2. Fills FLEX positions with the highest-scoring remaining eligible players
3. Benches players who don't fit in the starting lineup
4. Calculates total points based on **only the starting lineup**

This means if you trade 2 players for 3, but the 3rd player would sit on your bench anyway, the analyzer won't count their points.

## Example Scenario

**Without Trade:**
- Your lineup: 120.5 points
- Your bench: 3 players

**Proposed Trade:**
- You give: RB1 (15 pts), WR2 (12 pts)
- You get: WR1 (20 pts), RB2 (8 pts), WR3 (7 pts)

**Simple Math:** You lose 27 pts, gain 35 pts = +8 pts
**Smart Analysis:**
- WR1 (20 pts) replaces WR2 (12 pts) = +8 pts
- RB2 (8 pts) replaces RB1 (15 pts) = -7 pts
- WR3 (7 pts) sits on bench = 0 pts
- **Actual gain: +1 pt**

## API Information

This tool uses the official Sleeper API:
- **Base URL:** https://api.sleeper.app/v1
- **Rate Limit:** Stay under 1000 calls per minute
- **No Authentication Required** - The API is free and open

### Key Endpoints Used

- `GET /user/<username>` - Get user data
- `GET /league/<league_id>` - Get league settings
- `GET /league/<league_id>/rosters` - Get all rosters
- `GET /players/nfl` - Get all NFL players
- `GET /projections/nfl/<season>/<week>` - Get projections

## Scoring Settings

The analyzer respects your league's scoring settings:
- Passing yards, TDs, interceptions
- Rushing yards, TDs
- Receptions (PPR), receiving yards, TDs
- 2-point conversions
- Fumbles lost
- Bonus points for milestones

## Browser Compatibility

Works in all modern browsers:
- Chrome/Edge (recommended)
- Firefox
- Safari

## Files

- `login.html` - Login page for entering Sleeper username
- `index.html` - Main trade analyzer interface
- `styles.css` - Styling and layout
- `sleeper-api.js` - Sleeper API integration
- `lineup-optimizer.js` - Lineup optimization algorithm
- `app.js` - Main application logic with session management
- `vercel.json` - Vercel deployment configuration
- `package.json` - Project metadata
- `DEPLOYMENT.md` - Deployment guide for Vercel

## Troubleshooting

**"User not found"** - Check that you entered your exact Sleeper username (case-sensitive)

**"League not found"** - Verify your league ID from the Sleeper URL

**"Failed to fetch projections"** - The API might be down or projections aren't available yet for future weeks

**Players showing 0 points** - Projections may not be available for that player/week

## Privacy

All data is fetched directly from Sleeper's public API. Nothing is stored or sent to any third party. The app runs entirely in your browser.

## Sources

- [Sleeper API Documentation](https://docs.sleeper.com/)
- [Sleeper API Guide](https://github.com/SwapnikKatkoori/sleeper-api-wrapper)

## Contributing

Feel free to submit issues or pull requests to improve the analyzer!

## License

MIT License - Free to use and modify
