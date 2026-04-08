import "./css/main.styl";
import { mountWebDemoApp } from "./app";

console.log("Running HackCable web interface");

let disposeWebDemo: (() => void) | undefined;

async function bootWebDemo(): Promise<void> {
    disposeWebDemo?.();
    disposeWebDemo = await mountWebDemoApp();
}

void bootWebDemo();

/** Webpack HMR : `app.ts` et le graphe `src/*` peuvent se mettre à jour sans rechargement complet. */
declare const module: {
    hot?: {
        accept(path?: string, callback?: () => void): void;
    };
};

if (typeof module !== "undefined" && module.hot) {
    module.hot.accept("./app", () => {
        void bootWebDemo();
    });
    module.hot.accept();
}
