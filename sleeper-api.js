/**
 * Sleeper API Module
 * Handles all interactions with the Sleeper Fantasy Football API
 */

const SleeperAPI = {
    baseUrl: 'https://api.sleeper.app/v1',
    statsUrl: 'https://api.sleeper.com/stats/nfl',
    projectionsUrl: 'https://api.sleeper.com/projections/nfl',

    /**
     * Fetch user data by username
     */
    async getUser(username) {
        try {
            const response = await fetch(`${this.baseUrl}/user/${username}`);
            if (!response.ok) throw new Error('User not found');
            return await response.json();
        } catch (error) {
            console.error('Error fetching user:', error);
            throw error;
        }
    },

    /**
     * Get all leagues for a user in a given season
     */
    async getUserLeagues(userId, sport = 'nfl', season = '2024') {
        try {
            const response = await fetch(`${this.baseUrl}/user/${userId}/leagues/${sport}/${season}`);
            if (!response.ok) throw new Error('Failed to fetch leagues');
            return await response.json();
        } catch (error) {
            console.error('Error fetching leagues:', error);
            throw error;
        }
    },

    /**
     * Get specific league information
     */
    async getLeague(leagueId) {
        try {
            const response = await fetch(`${this.baseUrl}/league/${leagueId}`);
            if (!response.ok) throw new Error('League not found');
            return await response.json();
        } catch (error) {
            console.error('Error fetching league:', error);
            throw error;
        }
    },

    /**
     * Get all rosters in a league
     */
    async getRosters(leagueId) {
        try {
            const response = await fetch(`${this.baseUrl}/league/${leagueId}/rosters`);
            if (!response.ok) throw new Error('Failed to fetch rosters');
            return await response.json();
        } catch (error) {
            console.error('Error fetching rosters:', error);
            throw error;
        }
    },

    /**
     * Get all users in a league
     */
    async getLeagueUsers(leagueId) {
        try {
            const response = await fetch(`${this.baseUrl}/league/${leagueId}/users`);
            if (!response.ok) throw new Error('Failed to fetch users');
            return await response.json();
        } catch (error) {
            console.error('Error fetching league users:', error);
            throw error;
        }
    },

    /**
     * Get matchups for a specific week
     */
    async getMatchups(leagueId, week) {
        try {
            const response = await fetch(`${this.baseUrl}/league/${leagueId}/matchups/${week}`);
            if (!response.ok) throw new Error('Failed to fetch matchups');
            return await response.json();
        } catch (error) {
            console.error('Error fetching matchups:', error);
            throw error;
        }
    },

    /**
     * Get all NFL players
     */
    async getAllPlayers() {
        try {
            const response = await fetch(`${this.baseUrl}/players/nfl`);
            if (!response.ok) throw new Error('Failed to fetch players');
            return await response.json();
        } catch (error) {
            console.error('Error fetching players:', error);
            throw error;
        }
    },

    /**
     * Get player stats for a specific week
     */
    async getPlayerStats(season = '2024', week = null, seasonType = 'regular') {
        try {
            let url = `${this.statsUrl}/${season}`;
            if (week) {
                url += `/${week}`;
            }
            url += `?season_type=${seasonType}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch stats');
            return await response.json();
        } catch (error) {
            console.error('Error fetching player stats:', error);
            throw error;
        }
    },

    /**
     * Get player projections for a specific week
     */
    async getPlayerProjections(season = '2024', week = null, seasonType = 'regular') {
        try {
            let url = `${this.projectionsUrl}/${season}`;
            if (week) {
                url += `/${week}`;
            }
            url += `?season_type=${seasonType}`;

            const response = await fetch(url);
            if (!response.ok) {
                // Projections might not be available, use stats instead
                console.warn('Projections not available, falling back to stats');
                return await this.getPlayerStats(season, week, seasonType);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching projections:', error);
            // Fallback to stats
            return await this.getPlayerStats(season, week, seasonType);
        }
    },

    /**
     * Calculate fantasy points based on league scoring settings
     */
    calculateFantasyPoints(stats, scoringSettings) {
        if (!stats || !scoringSettings) return 0;

        let points = 0;

        // Map of stat keys to their values
        const statMappings = {
            // Passing
            'pass_yd': stats.pass_yd || 0,
            'pass_td': stats.pass_td || 0,
            'pass_int': stats.pass_int || 0,
            'pass_2pt': stats.pass_2pt || 0,

            // Rushing
            'rush_yd': stats.rush_yd || 0,
            'rush_td': stats.rush_td || 0,
            'rush_2pt': stats.rush_2pt || 0,

            // Receiving
            'rec': stats.rec || 0,
            'rec_yd': stats.rec_yd || 0,
            'rec_td': stats.rec_td || 0,
            'rec_2pt': stats.rec_2pt || 0,

            // Fumbles
            'fum_lost': stats.fum_lost || 0,

            // Special scoring
            'bonus_pass_yd_300': stats.pass_yd >= 300 ? 1 : 0,
            'bonus_pass_yd_400': stats.pass_yd >= 400 ? 1 : 0,
            'bonus_rush_yd_100': stats.rush_yd >= 100 ? 1 : 0,
            'bonus_rush_yd_200': stats.rush_yd >= 200 ? 1 : 0,
            'bonus_rec_yd_100': stats.rec_yd >= 100 ? 1 : 0,
            'bonus_rec_yd_200': stats.rec_yd >= 200 ? 1 : 0,
        };

        // Calculate points based on scoring settings
        for (const [statKey, statValue] of Object.entries(statMappings)) {
            if (scoringSettings[statKey]) {
                points += statValue * scoringSettings[statKey];
            }
        }

        return Math.round(points * 100) / 100;
    },

    /**
     * Get user's roster with player details
     */
    async getUserRosterWithDetails(leagueId, userId) {
        try {
            const [rosters, players] = await Promise.all([
                this.getRosters(leagueId),
                this.getAllPlayers()
            ]);

            const userRoster = rosters.find(r => r.owner_id === userId);
            if (!userRoster) throw new Error('User roster not found');

            // Enrich roster with player details
            userRoster.playerDetails = (userRoster.players || []).map(playerId => ({
                id: playerId,
                ...players[playerId]
            })).filter(p => p.id); // Filter out any invalid players

            return userRoster;
        } catch (error) {
            console.error('Error fetching user roster:', error);
            throw error;
        }
    }
};
