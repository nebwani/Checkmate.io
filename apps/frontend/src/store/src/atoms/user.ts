import {atom} from "recoil";

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export interface User{
    token: string;
    id: string;
    name: string;
}

export const userAtom = atom<User | null>({
    key: "user",
    // default: selector({
    //     key: "user/default",
    //     get: () => {
    //         try {
    //             const response =  fetch(`${BACKEND_URL}/auth/refresh`, {
    //                 method: "GET",
    //                 headers: {
    //                     "Content-Type": "application/json",
    //                 },
    //                 credentials: "include",

    //             });
    //         } catch (error) {
    //             console.log(error);                
    //         }
    //         return null;
    //     }       
    // }),
    default: null,
    
});