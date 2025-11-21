import React from 'react';
import { Icons } from './Icon';
import * as ReactRouterDOM from 'react-router-dom';

const { Link, useLocation } = ReactRouterDOM;

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  showBack?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, title, action, showBack = false }) => {
  const location = useLocation();
  
  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Header */}
      <header className="flex-shrink-0 h-14 px-4 flex items-center justify-between border-b border-gray-800/50 backdrop-blur-md bg-gray-950/80 sticky top-0 z-20">
        <div className="flex items-center gap-3">
            {showBack && (
                <Link to="/" className="p-1 -ml-1 rounded-full hover:bg-gray-800">
                    <Icons.ChevronLeft className="w-6 h-6 text-gray-300" />
                </Link>
            )}
            <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            {title}
            </h1>
        </div>
        <div>{action}</div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar p-4 pb-24">
        {children}
      </main>

      {/* Bottom Navigation (Only on Home) */}
      {!showBack && (
          <nav className="flex-shrink-0 h-16 bg-gray-900/90 border-t border-gray-800 flex items-center justify-around px-6 pb-safe backdrop-blur-lg absolute bottom-0 w-full z-30">
            <Link to="/" className={`flex flex-col items-center gap-1 ${location.pathname === '/' ? 'text-primary-400' : 'text-gray-500'}`}>
                <Icons.Music className="w-6 h-6" />
                <span className="text-[10px] font-medium">歌曲列表</span>
            </Link>
            <Link to="/settings" className={`flex flex-col items-center gap-1 ${location.pathname === '/settings' ? 'text-primary-400' : 'text-gray-500'}`}>
                <Icons.Cog className="w-6 h-6" />
                <span className="text-[10px] font-medium">设置</span>
            </Link>
          </nav>
      )}
    </div>
  );
};