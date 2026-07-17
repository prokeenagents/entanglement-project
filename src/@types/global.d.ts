import React from 'react';

export {};

declare global {
    namespace App {
        type ReactState<T> = [T, React.Dispatch<React.SetStateAction<T>>];
    }
}
