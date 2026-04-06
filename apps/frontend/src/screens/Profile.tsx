import { useEffect, useState } from "react";
import { BACKEND_URL } from "../store/src/atoms/user";
import { useParams, useNavigate } from "react-router-dom";
import { useSetUser } from "../store/src/hooks/useSetUser";
import { useUser } from "../store/src/hooks/useUser";

type ProfileType = {
  id: string;
  name: string | null;
  rating: number;
  history: GameHistory[];
};

type GameHistory = {
  opponent: string | null;
  result: "WIN" | "LOSS" | "DRAW" | null;
  moves: number;
  date: string;
};

export const Profile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const user = useUser();
  const setUser = useSetUser();
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const isOwnProfile = user && user?.id === userId;

  useEffect(() => {
    if (!userId) return;

    fetch(`${BACKEND_URL}/v1/user/${userId}`)
      .then(res => res.json())
      .then(data => setProfile(data));
  }, [userId]);

  const handleLogout = async () => {
    const confirmed = window.confirm("Are you sure you want to logout?");
    
    if (!confirmed) return;

    try {
      setIsLoggingOut(true);
      const response = await fetch(`${BACKEND_URL}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (response.ok) {
        setUser(null);
        navigate("/");
      } else {
        console.error("Logout failed");
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-gray-800 to-black text-white px-6 py-10">

      <div className="max-w-5xl mx-auto flex flex-col gap-8">

        {/* 🔥 PROFILE HEADER */}
        <div className="bg-gray-800/80 backdrop-blur-lg border border-gray-700 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">

          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center text-2xl font-bold">
              {profile.name?.[0] ?? "A"}
            </div>

            {/* Info */}
            <div className="text-center md:text-left">
              <h1 className="text-3xl font-bold">
                {profile.name ?? "Anonymous"}
              </h1>
              <p className="text-gray-400 mt-1">
                Player Rating
              </p>
              <p className="text-2xl font-semibold text-blue-400">
                {profile.rating}
              </p>
            </div>
          </div>

          {/* Logout Button - Only show if viewing own profile */}
          {isOwnProfile && (
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition"
            >
              {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
          )}

        </div>

        {/* 📊 GAME HISTORY */}
        <div className="bg-gray-800/80 backdrop-blur-lg border border-gray-700 rounded-2xl p-6 shadow-xl">

          <h2 className="text-xl font-semibold mb-4">
            Game History
          </h2>

          <div className="max-h-75 overflow-y-auto rounded-lg border border-gray-700">

            <table className="w-full text-sm">

              <thead className="bg-gray-700 sticky top-0 text-gray-300">
                <tr>
                  <th className="p-3 text-left">Opponent</th>
                  <th className="p-3 text-center">Result</th>
                  <th className="p-3 text-center">Moves</th>
                  <th className="p-3 text-center">Date</th>
                </tr>
              </thead>

              <tbody>
                {profile.history.map((game, index) => (
                  <tr
                    key={index}
                    className="border-t border-gray-700 hover:bg-gray-700/40 transition"
                  >
                    <td className="p-3">
                      {game.opponent ?? "Unknown"}
                    </td>

                    <td
                      className={`p-3 text-center font-semibold ${
                        game.result === "WIN"
                          ? "text-green-400"
                          : game.result === "LOSS"
                          ? "text-red-400"
                          : "text-yellow-400"
                      }`}
                    >
                      {game.result}
                    </td>

                    <td className="p-3 text-center">
                      {game.moves}
                    </td>

                    <td className="p-3 text-center text-gray-400">
                      {game.date
                        ? new Date(game.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Profile;