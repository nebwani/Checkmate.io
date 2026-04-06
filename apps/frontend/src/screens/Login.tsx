import Google from "../assets/google.png";
import Github from "../assets/github.png";


const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const Login = () => {
    

    const google = () => {
        window.open(`${BACKEND_URL}/auth/google`, "_self");
    };

    const github = () => {
        window.open(`${BACKEND_URL}/auth/github`, "_self");
    };


    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white px-4">
            <div className="flex flex-col items-center justify-center">
                <h1 className="text-2xl md:text-4xl font-extrabold leading-tight">
                    CheckMate<span className="text-blue-500">.io</span>
                </h1>

                <p className="text-center text-gray-400 mb-8">
                    Enter the Game World ♟️
                </p>
                <div className="bg-gray-800/80 backdrop-blur-lg border border-gray-700 rounded-2xl shadow-2xl p-8 w-full max-w-md">
                    <div className="mb-8 md:mb-0 justify-center flex flex-col">
                        <div
                            className="flex items-center justify-center gap-3 bg-gray-700 hover:bg-gray-600 border border-gray-600 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                            onClick={google}
                        >
                            <img src={Google} className="w-5 h-5" />
                            <span className="font-medium">Continue with Google</span>
                        </div>

                        <div className="flex items-center my-4">
                            <div className="grow h-px bg-gray-600"></div>
                            <span className="px-3 text-sm text-gray-400">OR</span>
                            <div className="grow h-px bg-gray-600"></div>
                        </div>

                        <div
                            className="flex items-center justify-center gap-3 bg-gray-700 hover:bg-gray-600 border border-gray-600 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                            onClick={github}
                        >
                            <img src={Github} className="w-5 h-5" />
                            <span className="font-medium">Continue with GitHub</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;