/**
 * Lineup Optimizer Module
 * Optimizes fantasy football lineups to maximize points based on roster positions
 */

const LineupOptimizer = {
    /**
     * Position eligibility mapping
     */
    positionEligibility: {
        'QB': ['QB'],
        'RB': ['RB'],
        'WR': ['WR'],
        'TE': ['TE'],
        'FLEX': ['RB', 'WR', 'TE'],
        'SUPER_FLEX': ['QB', 'RB', 'WR', 'TE'],
        'REC_FLEX': ['WR', 'TE'],
        'K': ['K'],
        'DEF': ['DEF']
    },

    /**
     * Parse roster positions from league settings
     */
    parseRosterPositions(rosterPositions) {
        const positions = [];

        for (const [position, count] of Object.entries(rosterPositions)) {
            // Skip bench and injured reserve
            if (position === 'BN' || position === 'IR') continue;

            for (let i = 0; i < count; i++) {
                positions.push(position);
            }
        }

        return positions;
    },

    /**
     * Check if a player is eligible for a position
     */
    isEligible(playerPosition, slotPosition) {
        const eligiblePositions = this.positionEligibility[slotPosition] || [slotPosition];
        return eligiblePositions.includes(playerPosition);
    },

    /**
     * Optimize lineup to maximize points
     * Uses a greedy algorithm with backtracking for FLEX positions
     */
    optimizeLineup(players, rosterPositions, playerProjections, scoringSettings = null, debugFn = null) {
        const positions = this.parseRosterPositions(rosterPositions);

        // Add projections to players
        const playersWithPoints = players.map((player, index) => {
            const playerId = player.player_id || player.id;
            const projection = playerProjections[playerId];

            // Debug EVERY player lookup for first 5 players
            if (debugFn && index < 5) {
                const playerName = player.full_name || (player.first_name && player.last_name ? player.first_name + ' ' + player.last_name : 'Unknown');
                debugFn(`  Player ${index + 1}: ${playerName}`);
                debugFn(`    player.id: ${player.id}`);
                debugFn(`    player.player_id: ${player.player_id}`);
                debugFn(`    Using ID for lookup: ${playerId}`);
                debugFn(`    Found projection: ${!!projection}`);

                if (projection) {
                    debugFn(`    Projection keys: ${Object.keys(projection).slice(0, 10).join(', ')}`);
                    debugFn(`    Projection.pts: ${projection.pts}`);
                    debugFn(`    Projection.pts_half_ppr: ${projection.pts_half_ppr}`);
                    debugFn(`    Projection.pts_ppr: ${projection.pts_ppr}`);
                } else {
                    // Check if ANY projection exists with similar ID
                    const projectionKeys = Object.keys(playerProjections);
                    debugFn(`    Total projections available: ${projectionKeys.length}`);
                    debugFn(`    Sample projection IDs: ${projectionKeys.slice(0, 5).join(', ')}`);
                }
            }

            let points = 0;
            if (projection) {
                // Try to get pre-calculated points first
                points = projection.pts || projection.pts_half_ppr || projection.pts_ppr || 0;

                // If no pre-calculated points and we have scoring settings, calculate from stats
                if (points === 0 && scoringSettings && typeof SleeperAPI !== 'undefined') {
                    points = SleeperAPI.calculateFantasyPoints(projection, scoringSettings);
                }

                // Debug calculated points for first 5 players
                if (debugFn && index < 5) {
                    debugFn(`    Calculated points: ${points}`);
                }
            }

            return {
                ...player,
                projectedPoints: points,
                position: player.position || player.fantasy_positions?.[0] || 'UNKNOWN'
            };
        });

        // Log summary of players with points
        const playersWithNonZeroPoints = playersWithPoints.filter(p => p.projectedPoints > 0);
        if (debugFn) {
            debugFn(`  ${playersWithNonZeroPoints.length}/${players.length} players have projections`);

            // Show sample of player projections
            if (playersWithNonZeroPoints.length > 0) {
                const samplesToShow = Math.min(3, playersWithNonZeroPoints.length);
                for (let i = 0; i < samplesToShow; i++) {
                    const p = playersWithNonZeroPoints[i];
                    debugFn(`    ${p.full_name || p.first_name + ' ' + p.last_name}: ${p.projectedPoints.toFixed(2)} pts`);
                }
                if (playersWithNonZeroPoints.length > 3) {
                    debugFn(`    ... and ${playersWithNonZeroPoints.length - 3} more`);
                }
            } else {
                // Debug: show why players don't have projections
                const samplePlayer = players[0];
                if (samplePlayer) {
                    const playerId = samplePlayer.player_id || samplePlayer.id;
                    const hasProjection = !!playerProjections[playerId];
                    debugFn(`    Debug: Sample player ID: ${playerId}, Has projection: ${hasProjection}`);
                    if (hasProjection) {
                        const proj = playerProjections[playerId];
                        debugFn(`    Projection keys: ${Object.keys(proj).join(', ')}`);
                    }
                }
            }
        }

        // Sort players by projected points (descending)
        playersWithPoints.sort((a, b) => b.projectedPoints - a.projectedPoints);

        const lineup = [];
        const usedPlayers = new Set();

        // Separate positions into dedicated and flex
        const dedicatedPositions = positions.filter(pos =>
            !pos.includes('FLEX') && pos !== 'BN' && pos !== 'IR'
        );
        const flexPositions = positions.filter(pos => pos.includes('FLEX'));

        // First pass: Fill dedicated positions (QB, RB, WR, TE, K, DEF)
        const positionGroups = {};
        dedicatedPositions.forEach(pos => {
            if (!positionGroups[pos]) positionGroups[pos] = [];
            positionGroups[pos].push(pos);
        });

        for (const [position, slots] of Object.entries(positionGroups)) {
            const eligiblePlayers = playersWithPoints.filter(p =>
                this.isEligible(p.position, position) && !usedPlayers.has(p.id || p.player_id)
            );

            for (let i = 0; i < slots.length; i++) {
                if (eligiblePlayers[i]) {
                    lineup.push({
                        slot: position,
                        player: eligiblePlayers[i],
                        points: eligiblePlayers[i].projectedPoints
                    });
                    usedPlayers.add(eligiblePlayers[i].id || eligiblePlayers[i].player_id);
                } else {
                    // No player available for this position
                    lineup.push({
                        slot: position,
                        player: null,
                        points: 0
                    });
                }
            }
        }

        // Second pass: Fill FLEX positions with remaining best players
        for (const flexPosition of flexPositions) {
            const eligiblePlayers = playersWithPoints.filter(p =>
                this.isEligible(p.position, flexPosition) && !usedPlayers.has(p.id || p.player_id)
            );

            if (eligiblePlayers.length > 0) {
                const bestPlayer = eligiblePlayers[0];
                lineup.push({
                    slot: flexPosition,
                    player: bestPlayer,
                    points: bestPlayer.projectedPoints
                });
                usedPlayers.add(bestPlayer.id || bestPlayer.player_id);
            } else {
                lineup.push({
                    slot: flexPosition,
                    player: null,
                    points: 0
                });
            }
        }

        // Calculate total points
        const totalPoints = lineup.reduce((sum, slot) => sum + slot.points, 0);

        return {
            lineup,
            totalPoints: Math.round(totalPoints * 100) / 100,
            benchPlayers: playersWithPoints.filter(p => !usedPlayers.has(p.id || p.player_id))
        };
    },

    /**
     * Compare two lineups and determine which is better
     */
    compareLineups(currentLineup, newLineup) {
        const difference = newLineup.totalPoints - currentLineup.totalPoints;

        return {
            currentPoints: currentLineup.totalPoints,
            newPoints: newLineup.totalPoints,
            difference: Math.round(difference * 100) / 100,
            percentageChange: currentLineup.totalPoints > 0
                ? Math.round((difference / currentLineup.totalPoints) * 10000) / 100
                : 0,
            recommendation: this.getRecommendation(difference)
        };
    },

    /**
     * Get trade recommendation based on point difference
     */
    getRecommendation(difference) {
        if (difference > 5) {
            return {
                type: 'positive',
                message: `Strong Accept! This trade would increase your lineup by ${Math.round(difference * 100) / 100} points per week.`
            };
        } else if (difference > 2) {
            return {
                type: 'positive',
                message: `Accept. This trade would give you an extra ${Math.round(difference * 100) / 100} points per week.`
            };
        } else if (difference > 0) {
            return {
                type: 'neutral',
                message: `Slight improvement of ${Math.round(difference * 100) / 100} points. Consider other factors like playoff schedule and bye weeks.`
            };
        } else if (difference > -2) {
            return {
                type: 'neutral',
                message: `Slight decline of ${Math.round(Math.abs(difference) * 100) / 100} points. Consider other factors before declining.`
            };
        } else if (difference > -5) {
            return {
                type: 'negative',
                message: `Decline. This trade would cost you ${Math.round(Math.abs(difference) * 100) / 100} points per week.`
            };
        } else {
            return {
                type: 'negative',
                message: `Strong Decline! This trade would hurt your lineup by ${Math.round(Math.abs(difference) * 100) / 100} points per week.`
            };
        }
    },

    /**
     * Simulate trade and compare lineups
     */
    analyzeTrade(currentRoster, tradingAway, tradingFor, rosterPositions, playerProjections, scoringSettings = null, debugFn = null) {
        // Create new roster after trade
        const newRoster = currentRoster.filter(player => {
            const playerId = player.id || player.player_id;
            return !tradingAway.some(p => (p.id || p.player_id) === playerId);
        });

        // Add incoming players
        newRoster.push(...tradingFor);

        if (debugFn) {
            debugFn(`  Current roster: ${currentRoster.length} players`);
            debugFn(`  New roster: ${newRoster.length} players`);
        }

        // Optimize both lineups
        const currentLineup = this.optimizeLineup(currentRoster, rosterPositions, playerProjections, scoringSettings, debugFn);
        const newLineup = this.optimizeLineup(newRoster, rosterPositions, playerProjections, scoringSettings, debugFn);

        // Compare lineups
        return {
            current: currentLineup,
            new: newLineup,
            comparison: this.compareLineups(currentLineup, newLineup)
        };
    }
};
