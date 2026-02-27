import React from 'react';
import { User } from 'lucide-react';
import { auth } from '../lib/firebase';

export const Header: React.FC = () => {
    const user = auth.currentUser;

    return (
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
            <h2 className="text-xl font-semibold text-slate-800">
                Bem vindo(a), {user?.displayName || 'Professor'}
            </h2>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-slate-700">{user?.displayName || 'Usuário'}</p>
                        <p className="text-xs text-slate-500">{user?.email}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200">
                        {user?.photoURL ? (
                            <img src={user.photoURL} alt="User" className="w-full h-full rounded-full" />
                        ) : (
                            <User className="w-5 h-5 text-indigo-600" />
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};
