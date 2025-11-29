import styles from "./index.module.css";
import { type FunctionComponent } from "react";

export type Scores = { [entrant: string]: number };

interface ScoresComponentProps {
    scores: Scores;
    onScoresChange?: (scores: Scores) => void;
}

const clamp = (min: number, max: number) => (value: number): number => {
  return Math.min(Math.max(value, min), max);
}

function string_to_color(str: string, prc: number) {
    'use strict';

    // Check for optional lightness/darkness
    var prc = typeof prc === 'number' ? prc : -10;

    // Generate a Hash for the String
    var hash = function(word: string) {
        var h = 0;
        for (var i = 0; i < word.length; i++) {
            h = word.charCodeAt(i) + ((h << 5) - h);
        }
        return h;
    };

    // Change the darkness or lightness
    var shade = function(color: string, prc: number) {
        var num = parseInt(color, 16),
            amt = Math.round(2.55 * prc),
            R = (num >> 16) + amt,
            G = (num >> 8 & 0x00FF) + amt,
            B = (num & 0x0000FF) + amt;
        return (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255))
            .toString(16)
            .slice(1);
    };

    // Convert init to an RGBA
    var int_to_rgba = function(i: number) {
        var color = ((i >> 24) & 0xFF).toString(16) +
            ((i >> 16) & 0xFF).toString(16) +
            ((i >> 8) & 0xFF).toString(16) +
            (i & 0xFF).toString(16);
        return color;
    };

    return shade(int_to_rgba(hash(str)), prc);

}

const ScoresComponent: FunctionComponent<ScoresComponentProps> = ({ scores, onScoresChange }) => {
    const clampScore = clamp(1, 10);
    const entrantList = Object.keys(scores);
    const sortedScores = [...new Set(
        Object.values(scores)
        )].sort((a, b) => b - a);

    return (
        <div className={styles.scoresComponent}>
            {entrantList.length === 0 ? (
                <p>No entrants available to score.</p>
            ) : (
                <ul className={styles.entrantScoresList}>
                    {entrantList.map((entrant, index) => {
                        const myScore = scores[entrant] || 0;
                        const position = sortedScores.findIndex(score => myScore === score) + 1;

                        return (
                            <li 
                                key={index} 
                                className={styles.entrantScoresListItem}
                                style={{backgroundColor: '#' + string_to_color(entrant, 40)}}>
                                <label className={styles.entrantLabel}>
                                    {entrant}:
                                    <input 
                                        className={styles.scoreInput}
                                        type="number" 
                                        min="1" 
                                        max="10" 
                                        disabled={onScoresChange === undefined}
                                        value={scores[entrant] || 0} 
                                        onChange={(e) => {
                                            const newScores = { ...scores, [entrant]: clampScore(e.target.valueAsNumber) }
                                            onScoresChange?.(newScores);
                                        }} />
                                </label>
                                { position === 1 && <sup>🥇</sup> }
                                { position === 2 && <sup>🥈</sup> }
                                { position === 3 && <sup>🥉</sup> }
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

export { ScoresComponent };