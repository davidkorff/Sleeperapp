/**
 * Main Application Logic
 * Handles UI interactions and orchestrates the trade analysis
 */

const App = {
    state: {
        user: null,
        league: null,
        roster: null,
        allRosters: [],
        leagueUsers: [],
        tradingPartnerRoster: null,
        players: null,
        projections: {}, // Store projections by week
        currentWeek: 1,
        tradingAway: [],
        tradingFor: []
    },

    /**
     * Initialize the application
     */
    async init() {
        // Check if user is logged in
        const username = localStorage.getItem('sleeperUsername');
        const userId = localStorage.getItem('sleeperUserId');

        if (!username || !userId) {
            // Redirect to login page
            window.location.href = '/';
            return;
        }

        // Display user info
        document.getElementById('userDisplay').textContent = `@${username}`;

        // Attach event listeners
        this.attachEventListeners();

        // Auto-load 2025 leagues
        await this.loadUserLeagues(userId, '2025');

        console.log('Trade Analyzer initialized');
    },

    /**
     * Attach event listeners to UI elements
     */
    attachEventListeners() {
        document.getElementById('loadSeason').addEventListener('click', () => {
            const season = document.getElementById('seasonSelect').value;
            const userId = localStorage.getItem('sleeperUserId');
            this.loadUserLeagues(userId, season);
        });
        document.getElementById('loadLeague').addEventListener('click', () => this.loadSelectedLeague());
        document.getElementById('addPlayerAway').addEventListener('click', () => this.addPlayerSelect('away'));
        document.getElementById('addPlayerFor').addEventListener('click', () => this.addPlayerSelect('for'));
        document.getElementById('analyzeTrade').addEventListener('click', () => this.analyzeTrade());
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
    },

    /**
     * Get current NFL week based on date
     */
    getCurrentWeek() {
        // NFL season 2025 starts September 4, 2025
        // NFL season 2024 started September 5, 2024
        const now = new Date();
        const currentYear = now.getFullYear();

        // Determine which season we're in
        let seasonStart;
        if (currentYear >= 2025 && now >= new Date('2025-09-04')) {
            seasonStart = new Date('2025-09-04');
        } else {
            seasonStart = new Date('2024-09-05');
        }

        const diffTime = now - seasonStart;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const week = Math.floor(diffDays / 7) + 1;

        // Clamp between 1 and 18
        return Math.max(1, Math.min(18, week));
    },

    /**
     * Logout user
     */
    logout() {
        localStorage.removeItem('sleeperUsername');
        localStorage.removeItem('sleeperUserId');
        localStorage.removeItem('sleeperUserData');
        window.location.href = '/';
    },

    /**
     * Load user's leagues
     */
    async loadUserLeagues(userId, season = '2025') {
        try {
            const loadingDiv = document.getElementById('leaguesLoading');
            const leaguesListDiv = document.getElementById('leaguesList');

            loadingDiv.style.display = 'block';
            leaguesListDiv.style.display = 'none';

            // Fetch user leagues for specified season
            const leagues = await SleeperAPI.getUserLeagues(userId, 'nfl', season);

            if (!leagues || leagues.length === 0) {
                this.showError(`No leagues found for the ${season} season`);
                loadingDiv.style.display = 'none';
                return;
            }

            // Populate league selector
            const leagueSelect = document.getElementById('leagueSelect');
            leagueSelect.innerHTML = '<option value="">Select a league...</option>';

            leagues.forEach(league => {
                const option = document.createElement('option');
                option.value = league.league_id;
                const season = league.season || '2025';
                option.textContent = `${league.name} - ${season} (${league.total_rosters} teams)`;
                option.dataset.league = JSON.stringify(league);
                leagueSelect.appendChild(option);
            });

            loadingDiv.style.display = 'none';
            leaguesListDiv.style.display = 'block';

        } catch (error) {
            console.error('Error loading leagues:', error);
            this.showError('Failed to load your leagues. Please try again.');
        }
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
     * Load selected league data
     */
    async loadSelectedLeague() {
        try {
            this.setLoading(true);

            const leagueSelect = document.getElementById('leagueSelect');
            const selectedOption = leagueSelect.options[leagueSelect.selectedIndex];
            const leagueId = leagueSelect.value;
            const userId = localStorage.getItem('sleeperUserId');

            if (!leagueId) {
                this.showError('Please select a league');
                this.setLoading(false);
                return;
            }

            // Get current week
            this.state.currentWeek = this.getCurrentWeek();

            // Update UI to show week range
            document.getElementById('currentWeekDisplay').textContent = `Week ${this.state.currentWeek}`;
            document.querySelectorAll('#weeksRange, #weeksRange2').forEach(el => {
                el.textContent = `${this.state.currentWeek}-18`;
            });

            // Get league data from the selected option
            const leagueData = JSON.parse(selectedOption.dataset.league);
            this.state.league = leagueData;

            // Fetch detailed league info (for scoring settings)
            const detailedLeague = await SleeperAPI.getLeague(leagueId);
            this.state.league = { ...leagueData, ...detailedLeague };

            // Fetch all rosters and users
            const [allRosters, leagueUsers, allPlayers] = await Promise.all([
                SleeperAPI.getRosters(leagueId),
                SleeperAPI.getLeagueUsers(leagueId),
                SleeperAPI.getAllPlayers()
            ]);

            this.state.allRosters = allRosters;
            this.state.leagueUsers = leagueUsers;
            this.state.players = allPlayers;

            // Debug logging
            console.log('User ID from localStorage:', userId);
            console.log('All rosters:', allRosters);
            console.log('League users:', leagueUsers);

            // Find user's roster
            const userRoster = allRosters.find(r => r.owner_id === userId);

            if (!userRoster) {
                console.error('User roster not found!');
                console.error('Looking for owner_id:', userId);
                console.error('Available owner_ids:', allRosters.map(r => r.owner_id));
                throw new Error(`User roster not found. Your user ID (${userId}) doesn't match any roster owner in this league.`);
            }

            console.log('Found user roster:', userRoster);
            console.log('User roster player IDs:', userRoster.players);

            // Enrich user roster with player details
            userRoster.playerDetails = (userRoster.players || []).map(playerId => {
                const playerData = allPlayers[playerId];
                if (!playerData) {
                    console.warn('Player not found in database:', playerId);
                    return null;
                }
                return {
                    id: playerId,
                    ...playerData
                };
            }).filter(p => p && p.id);

            console.log('Enriched player details:', userRoster.playerDetails);

            this.state.roster = userRoster;

            // Fetch projections for all remaining weeks
            const leagueSeason = this.state.league.season || '2025';
            this.state.projections = {};
            const projectionPromises = [];
            for (let week = this.state.currentWeek; week <= 18; week++) {
                projectionPromises.push(
                    SleeperAPI.getPlayerProjections(leagueSeason, week)
                        .then(data => {
                            this.state.projections[week] = data;
                        })
                        .catch(err => {
                            console.warn(`Failed to fetch projections for ${leagueSeason} week ${week}:`, err);
                            this.state.projections[week] = {};
                        })
                );
            }
            await Promise.all(projectionPromises);

            // Display league info
            this.displayLeagueInfo();

            // Populate team selector
            this.populateTeamSelector();

            // Populate trading partner dropdown
            this.populateTradingPartners();

            // Show trade section
            document.getElementById('tradeSection').style.display = 'block';

            // Initialize with one player select for trading away
            this.addPlayerSelect('away');

            // Add event listener for trading partner selection
            document.getElementById('tradingPartnerSelect').addEventListener('change', (e) => {
                this.onTradingPartnerSelected(e.target.value);
            });

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

        const season = this.state.league.season;
        const currentYear = new Date().getFullYear();
        const isCurrentSeason = season === currentYear.toString();

        leagueDetailsDiv.innerHTML = `
            <h4>${this.state.league.name}</h4>
            <p><strong>Season:</strong> ${season} ${!isCurrentSeason ? '<span style="color: #dc3545; font-weight: bold;">⚠️ NOT CURRENT SEASON</span>' : ''}</p>
            <p><strong>Scoring:</strong> ${this.state.league.scoring_settings?.rec ? 'PPR' : 'Standard'}</p>
            <p><strong>Teams:</strong> ${this.state.league.total_rosters}</p>
            ${!isCurrentSeason ? '<p style="color: #dc3545;"><strong>Warning:</strong> This league is from ' + season + ', not the current ' + currentYear + ' season!</p>' : ''}
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
     * Populate team selector dropdown
     */
    populateTeamSelector() {
        const select = document.getElementById('userTeamSelect');
        select.innerHTML = '';

        // Add all teams to dropdown
        const allTeams = this.state.allRosters.map(roster => {
            const user = this.state.leagueUsers.find(u => u.user_id === roster.owner_id);
            const teamName = user?.metadata?.team_name || user?.display_name || 'Unknown Team';
            const username = user?.display_name || user?.username || 'Unknown User';

            return {
                rosterId: roster.roster_id,
                ownerId: roster.owner_id,
                teamName,
                username,
                roster,
                playerCount: roster.players?.length || 0
            };
        }).sort((a, b) => a.teamName.localeCompare(b.teamName));

        allTeams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.rosterId;
            option.textContent = `${team.teamName} (@${team.username}) - ${team.playerCount} players`;
            option.dataset.team = JSON.stringify(team);
            if (team.rosterId === this.state.roster.roster_id) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        // Display current team info
        this.displayCurrentTeam();

        // Add change team button handler
        document.getElementById('changeTeam').onclick = () => this.changeUserTeam();
    },

    /**
     * Display current team information
     */
    displayCurrentTeam() {
        const currentUser = this.state.leagueUsers.find(u => u.user_id === this.state.roster.owner_id);
        const teamName = currentUser?.metadata?.team_name || currentUser?.display_name || 'Unknown Team';
        const username = currentUser?.display_name || currentUser?.username || 'Unknown User';

        const displayDiv = document.getElementById('currentTeamDisplay');
        displayDiv.innerHTML = `
            <div style="padding: 15px; background: #e7f3ff; border-left: 4px solid #667eea; border-radius: 6px;">
                <strong>Currently analyzing:</strong> ${teamName} (@${username})<br>
                <strong>Players on roster:</strong> ${this.state.roster.playerDetails?.length || 0}<br>
                <div style="margin-top: 10px; font-size: 0.9em;">
                    ${this.state.roster.playerDetails?.slice(0, 5).map(p =>
                        `<div>• ${p.full_name || p.first_name + ' ' + p.last_name} (${p.position || 'N/A'})</div>`
                    ).join('') || '<div>No players found</div>'}
                    ${this.state.roster.playerDetails?.length > 5 ? '<div>• ... and more</div>' : ''}
                </div>
            </div>
        `;
    },

    /**
     * Change user's team selection
     */
    changeUserTeam() {
        const select = document.getElementById('userTeamSelect');
        const selectedOption = select.options[select.selectedIndex];
        if (!selectedOption || !selectedOption.value) return;

        const team = JSON.parse(selectedOption.dataset.team);

        // Enrich roster with player details
        const roster = team.roster;
        roster.playerDetails = (roster.players || []).map(playerId => {
            const playerData = this.state.players[playerId];
            if (!playerData) {
                console.warn('Player not found in database:', playerId);
                return null;
            }
            return {
                id: playerId,
                ...playerData
            };
        }).filter(p => p && p.id);

        this.state.roster = roster;

        // Update display
        this.displayCurrentTeam();

        // Clear trade selections
        document.getElementById('tradingAway').innerHTML = '';
        this.addPlayerSelect('away');

        // Reset results
        document.getElementById('results').style.display = 'none';

        alert(`Team updated to: ${team.teamName}`);
    },

    /**
     * Populate trading partners dropdown
     */
    populateTradingPartners() {
        const select = document.getElementById('tradingPartnerSelect');
        select.innerHTML = '<option value="">Select a team...</option>';

        // Get all rosters except the user's
        const tradingPartners = this.state.allRosters
            .filter(roster => roster.owner_id !== this.state.roster.owner_id)
            .map(roster => {
                const user = this.state.leagueUsers.find(u => u.user_id === roster.owner_id);
                const teamName = user?.metadata?.team_name || user?.display_name || 'Unknown Team';

                return {
                    rosterId: roster.roster_id,
                    ownerId: roster.owner_id,
                    teamName,
                    roster
                };
            })
            .sort((a, b) => a.teamName.localeCompare(b.teamName));

        tradingPartners.forEach(partner => {
            const option = document.createElement('option');
            option.value = partner.rosterId;
            option.textContent = partner.teamName;
            option.dataset.partner = JSON.stringify(partner);
            select.appendChild(option);
        });
    },

    /**
     * Handle trading partner selection
     */
    onTradingPartnerSelected(rosterId) {
        const tradingForSection = document.getElementById('tradingForSection');
        const tradingForContainer = document.getElementById('tradingFor');
        const partnerNameSpan = document.getElementById('partnerTeamName');

        if (!rosterId) {
            tradingForSection.style.display = 'none';
            tradingForContainer.innerHTML = '';
            this.state.tradingPartnerRoster = null;
            return;
        }

        // Get selected partner
        const select = document.getElementById('tradingPartnerSelect');
        const selectedOption = select.options[select.selectedIndex];
        const partner = JSON.parse(selectedOption.dataset.partner);

        // Enrich partner roster with player details
        const partnerRoster = partner.roster;
        partnerRoster.playerDetails = (partnerRoster.players || []).map(playerId => ({
            id: playerId,
            ...this.state.players[playerId]
        })).filter(p => p.id);

        this.state.tradingPartnerRoster = partnerRoster;

        // Update UI
        partnerNameSpan.textContent = partner.teamName;
        tradingForSection.style.display = 'block';
        tradingForContainer.innerHTML = '';

        // Add initial player select
        this.addPlayerSelect('for');
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

        // For trading away, show user's roster; for trading for, show partner's roster
        const availablePlayers = type === 'away'
            ? this.state.roster.playerDetails
            : (this.state.tradingPartnerRoster?.playerDetails || []);

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

            // Analyze trade for all remaining weeks
            const weeklyAnalysis = [];
            let totalCurrentPoints = 0;
            let totalNewPoints = 0;

            for (let week = this.state.currentWeek; week <= 18; week++) {
                const weekProjections = this.state.projections[week] || {};

                const analysis = LineupOptimizer.analyzeTrade(
                    this.state.roster.playerDetails,
                    tradingAway,
                    tradingFor,
                    rosterPositions,
                    weekProjections
                );

                weeklyAnalysis.push({
                    week,
                    ...analysis
                });

                totalCurrentPoints += analysis.current.totalPoints;
                totalNewPoints += analysis.new.totalPoints;
            }

            // Create aggregate analysis
            const aggregateAnalysis = {
                weekly: weeklyAnalysis,
                season: {
                    currentPoints: totalCurrentPoints,
                    newPoints: totalNewPoints,
                    difference: totalNewPoints - totalCurrentPoints,
                    percentageChange: totalCurrentPoints > 0
                        ? ((totalNewPoints - totalCurrentPoints) / totalCurrentPoints) * 100
                        : 0
                }
            };

            // Display results
            this.displayResults(aggregateAnalysis);

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
        const recommendationDiv = document.getElementById('recommendation');

        // Get recommendation based on season difference
        const rec = this.getSeasonRecommendation(analysis.season.difference);

        // Display recommendation
        recommendationDiv.className = `recommendation ${rec.type}`;
        recommendationDiv.innerHTML = `
            <div style="font-size: 1.5em; margin-bottom: 10px;">
                ${rec.type === 'positive' ? '✓' : rec.type === 'negative' ? '✗' : '⚠'}
            </div>
            <div>${rec.message}</div>
            <div style="margin-top: 10px; font-size: 1.1em;">
                Total Point Difference: ${analysis.season.difference > 0 ? '+' : ''}${analysis.season.difference.toFixed(2)}
                (${analysis.season.percentageChange > 0 ? '+' : ''}${analysis.season.percentageChange.toFixed(1)}%)
            </div>
        `;

        // Display season summary
        document.getElementById('seasonCurrentPoints').textContent = analysis.season.currentPoints.toFixed(2);
        document.getElementById('seasonNewPoints').textContent = analysis.season.newPoints.toFixed(2);
        const diffElement = document.getElementById('seasonDifference');
        diffElement.textContent = (analysis.season.difference > 0 ? '+' : '') + analysis.season.difference.toFixed(2);
        diffElement.style.color = analysis.season.difference > 0 ? '#28a745' : analysis.season.difference < 0 ? '#dc3545' : '#999';

        // Display weekly breakdown
        const weeklyBreakdownDiv = document.getElementById('weeklyBreakdown');
        weeklyBreakdownDiv.innerHTML = analysis.weekly.map(weekData => {
            const diff = weekData.new.totalPoints - weekData.current.totalPoints;
            const diffClass = diff > 0 ? 'positive' : diff < 0 ? 'negative' : '';

            return `
                <div class="week-row">
                    <div class="week-label">Week ${weekData.week}</div>
                    <div class="week-points">
                        <strong>Without:</strong> ${weekData.current.totalPoints.toFixed(2)} pts
                    </div>
                    <div class="week-points">
                        <strong>With:</strong> ${weekData.new.totalPoints.toFixed(2)} pts
                    </div>
                    <div class="week-diff ${diffClass}">
                        ${diff > 0 ? '+' : ''}${diff.toFixed(2)} pts
                    </div>
                </div>
            `;
        }).join('');

        // Add toggle functionality
        const toggleBtn = document.getElementById('toggleWeekly');
        toggleBtn.onclick = () => {
            const isHidden = weeklyBreakdownDiv.style.display === 'none';
            weeklyBreakdownDiv.style.display = isHidden ? 'block' : 'none';
        };

        resultsDiv.style.display = 'block';
    },

    /**
     * Get recommendation based on season point difference
     */
    getSeasonRecommendation(difference) {
        if (difference > 20) {
            return {
                type: 'positive',
                message: `Strong Accept! This trade would increase your total points by ${difference.toFixed(2)} for the rest of the season.`
            };
        } else if (difference > 10) {
            return {
                type: 'positive',
                message: `Accept. This trade would give you an extra ${difference.toFixed(2)} points for the rest of the season.`
            };
        } else if (difference > 0) {
            return {
                type: 'neutral',
                message: `Slight improvement of ${difference.toFixed(2)} points for the season. Consider other factors like playoff schedule.`
            };
        } else if (difference > -10) {
            return {
                type: 'neutral',
                message: `Slight decline of ${Math.abs(difference).toFixed(2)} points for the season. Consider other factors before declining.`
            };
        } else if (difference > -20) {
            return {
                type: 'negative',
                message: `Decline. This trade would cost you ${Math.abs(difference).toFixed(2)} points for the rest of the season.`
            };
        } else {
            return {
                type: 'negative',
                message: `Strong Decline! This trade would hurt your total points by ${Math.abs(difference).toFixed(2)} for the rest of the season.`
            };
        }
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
