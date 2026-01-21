
export function calculateElo(
    whiteRating: number,
    blackRating: number,
    result: "WHITE_WINS" | "BLACK_WINS" | "DRAW"
) {
    const K = 32;

    const expectedWhite = 1 / (1 + Math.pow(10, (blackRating - whiteRating) / 400));

    const expectedBlack = 1 / (1 + Math.pow(10, (whiteRating - blackRating) / 400));

    let scoreWhite = 0;
    let scoreBlack = 0;

    if (result === "WHITE_WINS") {
        scoreWhite = 1;
        scoreBlack = 0;
    } else if (result === "BLACK_WINS") {
        scoreWhite = 0;
        scoreBlack = 1;
    } else {
        scoreWhite = 0.5;
        scoreBlack = 0.5;
    }

    const newWhite = Math.round(whiteRating + K * (scoreWhite - expectedWhite));
    const newBlack = Math.round(blackRating + K * (scoreBlack - expectedBlack));

    return {newWhite, newBlack};
}