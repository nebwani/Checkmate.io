import { db } from "@repo/db";
import { Router } from "express";

const v1Router = Router();

v1Router.get("/", (req, res) => {
  res.send("Hello, World!");
});

type GameHistory = {
  opponent: string | null;
  result: "WIN" | "LOSS" | "DRAW" | null;
  moves: number;
  date: string;
};

type GameResult = "WHITE_WINS" | "BLACK_WINS" | "DRAW" | null;

function getResult(
  gameResult: GameResult | null,
  userId: string,
  whitePlayerId: string,
  blackPlayerId: string,
): "WIN" | "LOSS" | "DRAW" | null {
  if (!gameResult) return null;

  if (gameResult === "DRAW") return "DRAW";

  if (gameResult === "WHITE_WINS") {
    return userId ===  whitePlayerId? "WIN" : "LOSS";
  }

  if (gameResult === "BLACK_WINS") {
    return userId === blackPlayerId? "WIN" : "LOSS";
  }

  return null;
}

v1Router.get("/user/:userId", async(req, res) => {
  const {userId} = req.params;

  const user = await db.user.findUnique({
    where: {id: userId},
    select: {
      id: true,
      name: true,
      rating: true,
      gamesAsWhite: {
        select: {
          id: true,
          startAt: true,
          moves: true,
          result: true,
          blackPlayer: {
            select: {
              id: true,
              name: true,
              username: true
            }
          }
        }
      },
      gamesAsBlack: {
        select: {
          id: true,
          startAt: true,
          moves: true,
          result: true, 
          whitePlayer: {
            select: {
              id: true,
              name: true,
              username: true
            }
          }
        }
      }
    }
  });


  if(!user){
    return res.status(404).json({ message: "User not found" });
  }
 

  const history : GameHistory[] = [];
  user?.gamesAsWhite.forEach((game) => {
    history.push({
      opponent: game.blackPlayer.name,
      result: getResult(game.result, userId, user.id, game.blackPlayer.id),
      moves: game.moves.length,
      date: game.startAt.toISOString(),
    });
  });
  user.gamesAsBlack.forEach((game) => {
    history.push({
      opponent: game.whitePlayer.name,
      result: getResult(game.result, userId, game.whitePlayer.id, user.id),
      moves: game.moves.length,
      date: game.startAt.toISOString(),
    });
  });

  history.sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  res.json({
    id: user.id,
    name: user.name,
    rating: user.rating,
    history
  });
});

export default v1Router;