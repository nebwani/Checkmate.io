import {atom, selector} from "recoil";

export const BACKEND_URL = "http://localhost:3000";

export interface User{
    token: string;
    id: string;
    name: string;
}

export const userAtom = atom<User | null>({
    key: "user",
    default: selector({
        key: "user/default",
        get: () => {
            try {
                const response =  fetch(`${BACKEND_URL}/auth/refresh`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",

                });
            } catch (error) {
                console.log(error);                
            }
            return null;
        }       
    }),
    
});