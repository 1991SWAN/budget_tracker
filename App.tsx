import React, { Suspense, lazy } from 'react';
import { AppShell } from './components/layout/AppShell';
import { GlobalOverlayHost } from './components/layout/GlobalOverlayHost';
import { LoginView } from './components/LoginView';
import { useAuth } from './contexts/AuthContext';
import { useAppController } from './hooks/useAppController';

const DashboardScreenLazy = lazy(async () => {
    const module = await import('./components/screens/DashboardScreen');
    return { default: module.DashboardScreen };
});

const TransactionsScreenLazy = lazy(async () => {
    const module = await import('./components/screens/TransactionsScreen');
    return { default: module.TransactionsScreen };
});

const AssetsScreenLazy = lazy(async () => {
    const module = await import('./components/screens/AssetsScreen');
    return { default: module.AssetsScreen };
});

const SettingsViewLazy = lazy(async () => {
    const module = await import('./components/settings/SettingsView');
    return { default: module.SettingsView };
});

const CategorySettingsLazy = lazy(async () => {
    const module = await import('./components/settings/CategorySettings');
    return { default: module.CategorySettings };
});

const ImportSettingsLazy = lazy(async () => {
    const module = await import('./components/settings/ImportSettings');
    return { default: module.ImportSettings };
});

const App: React.FC = () => {
    const { user, isLoading } = useAuth();
    const controller = useAppController(user);
    const viewLoader = (
        <div className="min-h-[360px] flex items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-indigo-600" />
        </div>
    );

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!user) {
        return <LoginView />;
    }

    return (
        <AppShell
            view={controller.shell.view}
            onNavigate={controller.shell.onNavigate}
            onImportClick={controller.shell.onImportClick}
            onImportFile={controller.shell.onImportFile}
            onQuickAddClick={controller.shell.onQuickAddClick}
            onAddAsset={controller.shell.onAddAsset}
        >
            <GlobalOverlayHost {...controller.overlays} />

            <Suspense fallback={viewLoader}>
                {controller.shell.view === 'dashboard' && (
                    <DashboardScreenLazy {...controller.screens.dashboard} />
                )}

                {controller.shell.view === 'transactions' && (
                    <TransactionsScreenLazy {...controller.screens.transactions} />
                )}

                {controller.shell.view === 'assets' && (
                    <AssetsScreenLazy {...controller.screens.assets} />
                )}

                {controller.shell.view === 'settings' && (
                    <SettingsViewLazy onNavigate={controller.shell.onNavigate} />
                )}

                {controller.shell.view === 'settings-categories' && (
                    <CategorySettingsLazy onNavigate={controller.shell.onNavigate} />
                )}

                {controller.shell.view === 'settings-import' && (
                    <ImportSettingsLazy
                        onNavigate={controller.shell.onNavigate}
                        onImportFile={controller.shell.onImportFile}
                    />
                )}
            </Suspense>
        </AppShell>
    );
};

export default App;
