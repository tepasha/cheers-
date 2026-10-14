declare module 'promise/setimmediate/rejection-tracking' {
  const tracker: {
    enable(options: { allRejections: boolean; onUnhandled: (id: number, error: unknown) => void; onHandled: (id: number) => void }): void;
    disable(): void;
  };
  export default tracker;
}

declare module 'react-native/Libraries/promiseRejectionTrackingOptions' {
  const options: { allRejections: boolean; onUnhandled: (id: number, error: unknown) => void; onHandled: (id: number) => void };
  export default options;
}
