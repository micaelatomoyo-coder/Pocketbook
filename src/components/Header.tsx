
import { BookOpen, LogIn, LogOut, User as UserIcon } from 'lucide-react';

interface HeaderProps {
  totalCount: number;
  user: any;
  login: () => void;
  logout: () => void;
}

export function Header({ totalCount, user, login, logout }: HeaderProps) {
  return (
    <header className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <BookOpen size={24} strokeWidth={2.5} />
          </div>
          <div className="hidden xs:block">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-none">Pocketbook</h1>
            <p className="text-xs font-medium text-indigo-600 uppercase tracking-widest mt-1">Creator</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 sm:gap-8">
          <div className="hidden sm:block text-right">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Comunidade</p>
            <p className="text-lg font-black text-indigo-600 leading-none mt-1">{totalCount.toLocaleString()}</p>
          </div>

          <div className="h-8 w-[1px] bg-gray-100 hidden sm:block"></div>

          {user ? (
            <div className="flex items-center gap-3 group">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Usuário</p>
                <p className="text-sm font-bold text-gray-900 leading-none mt-1 truncate max-w-[100px]">
                  {user.displayName || 'Artesão'}
                </p>
              </div>
              <div className="relative">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName} className="w-9 h-9 rounded-full border border-gray-100" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                    <UserIcon size={20} />
                  </div>
                )}
                <button 
                  onClick={logout}
                  className="absolute -top-1 -right-1 bg-white border border-gray-100 rounded-full p-1 text-gray-400 hover:text-rose-500 shadow-sm hover:shadow transition-all"
                  title="Sair"
                >
                  <LogOut size={12} />
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={login}
              className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:border-indigo-200 hover:text-indigo-600 transition-all active:scale-95"
            >
              <LogIn size={18} />
              <span className="hidden sm:inline">Entrar</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
