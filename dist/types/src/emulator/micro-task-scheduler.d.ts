export type IMicroTaskCallback = () => void;
export declare class MicroTaskScheduler {
    private readonly channel;
    private readonly executionQueue;
    private _stopped;
    start(): void;
    stop(): void;
    get stopped(): boolean;
    postTask(fn: IMicroTaskCallback): void;
    private readonly handleMessage;
}
