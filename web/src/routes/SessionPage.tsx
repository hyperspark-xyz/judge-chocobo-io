import { useLoaderData } from "@tanstack/react-router";
import { useEffect, useState, type FunctionComponent } from "react";
import { getScores, registerJudge, updateEntrantList, updateScores } from "../api";
import { ScoresComponent, type Scores } from "../components/ScoresComponent";
import styles from "./SessionPage.module.css";

const SessionPage: FunctionComponent = () => {
    const { session, entrants } = useLoaderData({ from: '/s/$sessionId' });
    const [entrantList, setEntrantList] = useState<string[]>(entrants || []);
    const [entrantInput, setEntrantInput] = useState('');
    const [scores, setScores] = useState<Scores>({});
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [otherScores, setOtherScores] = useState<Record<string, Scores>>({});

    console.log(session);

    useEffect(() => {
        registerJudge(session.id, 'host');
    }, [])

    useEffect(() => {
        updateEntrantList(session.id, entrantList)
    }, [entrantList]);

    useEffect(() => {
        getScores(session.id, 'host')
            .then(retrievedScores => {
                const newScores: Scores = {};

                for (const entrant of entrantList) {
                    newScores[entrant] = retrievedScores[entrant] || 0;
                }

                setScores(newScores);
            });
    }, [entrantList]);
    
    useEffect(() => {
        if (socket) {
            return;
        }

        console.log("Opening WebSocket connection");

        const ws = new WebSocket(`${import.meta.env.VITE_WS_BASE_URL}/ws?sessionId=${session.id}&judgeName=host`);

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);

            console.log("Received WebSocket message:", message);

            if (message.type === 'scoreUpdate' && message.judgeName !== 'host') {
                setOtherScores((prevScores) => ({
                    ...prevScores,
                    [message.judgeName]: message.scores,
                }));
            }
        };

        setSocket(ws);

        window.onbeforeunload = () => {
            ws.close();
        };

        return () => {
            ws.close();
        };
    }, [])

    return (
        <div className="session-page">
            <h1>Session Page</h1>
            <div className={styles.entrantManagement}>
                <div className="entrant-list">
                    <h2>Entrants</h2>
                    <ul>
                        {entrantList.map((entrant, index) => (
                            <li key={index}>{entrant}</li>
                        ))}
                    </ul>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        setEntrantList(entrantList.concat(entrantInput));
                        setEntrantInput("");
                    }}>
                        <input type="text" value={entrantInput} onChange={(e) => setEntrantInput(e.target.value)}/>
                        <button type="submit">Add Entrant</button>
                    </form>
                </div>
                <div className="your-scores">
                    <h2>Your Scores</h2>
                    <ScoresComponent scores={scores} onScoresChange={(scores) => {
                        updateScores(session.id, 'host', scores);
                        setScores(scores);
                    }}/>
                </div>
                {Object.entries(otherScores).map(([judgeName, scores]) => (
                    <div className="other-judge-scores" key={judgeName}>
                        <h2>{judgeName}'s Scores</h2>
                        <ScoresComponent scores={scores}/>
                    </div>
                ))}
                <div className="total-scores">
                    <h2>Total Scores</h2>
                    <ScoresComponent scores={entrantList.reduce((acc, entrant) => {
                        acc[entrant] = Object.values(otherScores).reduce((sum, judgeScores) => {
                            return sum + (judgeScores[entrant] || 0);
                        }, scores[entrant] || 0);
                        return acc;
                    }, {} as Scores)}/>
                </div>
            </div>
        </div>
    )
}

export {SessionPage}