/**
 * Main Application Logic
 * Handles UI interactions and orchestrates the trade analysis
 */

const App = {
    state: {
        user: null,
        league: null,
        roster: null,
        players: null,
        projections: null,
        tradingAway: [],
        tradingFor: []
    },

    /**
     * Initialize the application
     */
    init() {
        this.attachEventListeners();
        console.log('Trade Analyzer initialized');
    },

    /**
     * Attach event listeners to UI elements
     */
    attachEventListeners() {
        document.getElementById('loadLeague').addEventListener('click', () => this.loadLeague());
        document.getElementById('addPlayerAway').addEventListener('click', () => this.addPlayerSelect('away'));
        document.getElementById('addPlayerFor').addEventListener('click', () => this.addPlayerSelect('for'));
        document.getElementById('analyzeTrade').addEventListener('click', () => this.analyzeTrade());
    },

    /**
     * Show/hide loading indicator
     */
    setLoading(isLoading) {
        document.getElementById('loading').style.display = isLoading ? 'block' : 'none';
    },

    /**
     * Show error message
     */
    showError(message) {
        const errorDiv = document.getElementById('error');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';

        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    },

    /**
     * Load league data
     */
    async loadLeague() {
        try {
            this.setLoading(true);

            const username = document.getElementById('username').value.trim();
            const leagueId = document.getElementById('leagueId').value.trim();
            const week = parseInt(document.getElementById('week').value);

            if (!username || !leagueId) {
                this.showError('Please enter both username and league ID');
                return;
            }

            // Fetch user data
            this.state.user = await SleeperAPI.getUser(username);

            // Fetch league data
            this.state.league = await SleeperAPI.getLeague(leagueId);

            // Fetch user's roster with player details
            this.state.roster = await SleeperAPI.getUserRosterWithDetails(leagueId, this.state.user.user_id);

            // Fetch all players
            this.state.players = await SleeperAPI.getAllPlayers();

            // Fetch projections for the specified week
            this.state.projections = await SleeperAPI.getPlayerProjections('2024', week);

            // Display league info
            this.displayLeagueInfo();

            // Show trade section
            document.getElementById('tradeSection').style.display = 'block';

            // Initialize with one player select in each column
            this.addPlayerSelect('away');
            this.addPlayerSelect('for');

            this.setLoading(false);
        } catch (error) {
            console.error('Error loading league:', error);
            this.showError('Failed to load league data. Please check your inputs and try again.');
            this.setLoading(false);
        }
    },

    /**
     * Display league information
     */
    displayLeagueInfo() {
        const leagueInfoDiv = document.getElementById('leagueInfo');
        const leagueDetailsDiv = document.getElementById('leagueDetails');
        const rosterInfoDiv = document.getElementById('rosterInfo');

        leagueDetailsDiv.innerHTML = `
            <h4>${this.state.league.name}</h4>
            <p><strong>Season:</strong> ${this.state.league.season}</p>
            <p><strong>Scoring:</strong> ${this.state.league.scoring_settings?.rec ? 'PPR' : 'Standard'}</p>
            <p><strong>Teams:</strong> ${this.state.league.total_rosters}</p>
        `;

        const rosterSlots = Object.entries(this.state.league.roster_positions)
            .filter(([pos, count]) => count > 0)
            .map(([pos, count]) => `<div class="roster-slot">${count}x ${pos}</div>`)
            .join('');

        rosterInfoDiv.innerHTML = `
            <h4>Roster Configuration</h4>
            <div class="roster-slots">${rosterSlots}</div>
        `;

        leagueInfoDiv.style.display = 'block';
    },

    /**
     * Add a player select dropdown
     */
    addPlayerSelect(type) {
        const container = type === 'away'
            ? document.getElementById('tradingAway')
            : document.getElementById('tradingFor');

        const selectDiv = document.createElement('div');
        selectDiv.className = 'player-select';

        const select = document.createElement('select');
        select.innerHTML = '<option value="">Select a player...</option>';

        // For trading away, only show players on user's roster
        const availablePlayers = type === 'away'
            ? this.state.roster.playerDetails
            : Object.values(this.state.players).filter(p => p.active && p.fantasy_positions);

        // Sort players by position and name
        const sortedPlayers = availablePlayers.sort((a, b) => {
            const posA = a.position || a.fantasy_positions?.[0] || 'ZZ';
            const posB = b.position || b.fantasy_positions?.[0] || 'ZZ';
            if (posA !== posB) return posA.localeCompare(posB);
            return (a.full_name || a.first_name + ' ' + a.last_name).localeCompare(
                b.full_name || b.first_name + ' ' + b.last_name
            );
        });

        sortedPlayers.forEach(player => {
            if (!player) return;
            const playerId = player.id || player.player_id;
            const playerName = player.full_name || `${player.first_name} ${player.last_name}`;
            const position = player.position || player.fantasy_positions?.[0] || '';
            const team = player.team || '';

            const option = document.createElement('option');
            option.value = playerId;
            option.textContent = `${playerName} (${position} - ${team})`;
            select.appendChild(option);
        });

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-player';
        removeBtn.textContent = '×';
        removeBtn.onclick = () => selectDiv.remove();

        selectDiv.appendChild(select);
        selectDiv.appendChild(removeBtn);
        container.appendChild(selectDiv);
    },

    /**
     * Get selected players from a container
     */
    getSelectedPlayers(containerId) {
        const container = document.getElementById(containerId);
        const selects = container.querySelectorAll('select');
        const players = [];

        selects.forEach(select => {
            if (select.value) {
                const player = this.state.players[select.value];
                if (player) {
                    players.push({
                        id: select.value,
                        player_id: select.value,
                        ...player
                    });
                }
            }
        });

        return players;
    },

    /**
     * Analyze the trade
     */
    async analyzeTrade() {
        try {
            this.setLoading(true);

            const tradingAway = this.getSelectedPlayers('tradingAway');
            const tradingFor = this.getSelectedPlayers('tradingFor');

            if (tradingAway.length === 0 || tradingFor.length === 0) {
                this.showError('Please select players for both sides of the trade');
                this.setLoading(false);
                return;
            }

            // Get roster positions from league settings
            const rosterPositions = {};
            this.state.league.roster_positions.forEach((pos, index) => {
                const positionName = this.state.league.roster_positions[index];
                if (positionName) {
                    rosterPositions[positionName] = (rosterPositions[positionName] || 0) + 1;
                }
            });

            // If roster_positions is an object already
            if (typeof this.state.league.roster_positions === 'object' && !Array.isArray(this.state.league.roster_positions)) {
                Object.assign(rosterPositions, this.state.league.roster_positions);
            }

            // Analyze the trade
            const analysis = LineupOptimizer.analyzeTrade(
                this.state.roster.playerDetails,
                tradingAway,
                tradingFor,
                rosterPositions,
                this.state.projections
            );

            // Display results
            this.displayResults(analysis);

            this.setLoading(false);
        } catch (error) {
            console.error('Error analyzing trade:', error);
            this.showError('Failed to analyze trade. Please try again.');
            this.setLoading(false);
        }
    },

    /**
     * Display trade analysis results
     */
    displayResults(analysis) {
        const resultsDiv = document.getElementById('results');
        const currentLineupDiv = document.getElementById('currentLineup');
        const newLineupDiv = document.getElementById('newLineup');
        const currentPointsSpan = document.getElementById('currentPoints');
        const newPointsSpan = document.getElementById('newPoints');
        const recommendationDiv = document.getElementById('recommendation');

        // Display current lineup
        currentLineupDiv.innerHTML = this.renderLineup(analysis.current.lineup);
        currentPointsSpan.textContent = analysis.current.totalPoints.toFixed(2);

        // Display new lineup
        newLineupDiv.innerHTML = this.renderLineup(analysis.new.lineup);
        newPointsSpan.textContent = analysis.new.totalPoints.toFixed(2);

        // Display recommendation
        const rec = analysis.comparison.recommendation;
        recommendationDiv.className = `recommendation ${rec.type}`;
        recommendationDiv.innerHTML = `
            <div style="font-size: 1.5em; margin-bottom: 10px;">
                ${rec.type === 'positive' ? '✓' : rec.type === 'negative' ? '✗' : '⚠'}
            </div>
            <div>${rec.message}</div>
            <div style="margin-top: 10px; font-size: 1.1em;">
                Point Difference: ${analysis.comparison.difference > 0 ? '+' : ''}${analysis.comparison.difference.toFixed(2)}
                (${analysis.comparison.percentageChange > 0 ? '+' : ''}${analysis.comparison.percentageChange.toFixed(1)}%)
            </div>
        `;

        resultsDiv.style.display = 'block';
    },

    /**
     * Render a lineup
     */
    renderLineup(lineup) {
        return lineup.map(slot => {
            const player = slot.player;
            const playerName = player
                ? (player.full_name || `${player.first_name} ${player.last_name}`)
                : 'Empty';
            const playerTeam = player?.team || '';
            const playerPos = player?.position || player?.fantasy_positions?.[0] || '';
            const points = slot.points.toFixed(2);
            const isFlex = slot.slot.includes('FLEX');

            return `
                <div class="lineup-position ${isFlex ? 'flex' : ''}">
                    <div class="position-label">${slot.slot}</div>
                    <div class="player-info">
                        <div class="player-name">${playerName}</div>
                        ${player ? `<div class="player-team">${playerPos} - ${playerTeam}</div>` : ''}
                    </div>
                    <div class="player-points">${points} pts</div>
                </div>
            `;
        }).join('');
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
