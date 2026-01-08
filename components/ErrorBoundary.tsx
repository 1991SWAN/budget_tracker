import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
    }

    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 bg-red-50 text-red-900 border border-red-200 rounded-lg">
                    <h2 className="font-bold text-lg mb-2">Something went wrong.</h2>
                    <pre className="text-xs overflow-auto p-2 bg-white/50 rounded">{this.state.error?.toString()}</pre>
                    <pre className="text-xs mt-2 text-red-500">Check developer console for stack trace</pre>
                </div>
            );
        }

        return (this as any).props.children;
    }
}

export default ErrorBoundary;
