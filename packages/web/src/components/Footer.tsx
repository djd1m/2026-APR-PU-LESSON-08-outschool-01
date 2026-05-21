import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-gray-50">
      <div className="container-page py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="text-lg font-bold text-primary-600">
              КлассМаркет
            </Link>
            <p className="mt-2 text-sm text-gray-500">
              Маркетплейс живых онлайн-классов для детей от 3 до 18 лет.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Ученикам</h4>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href="/classes"
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Каталог
                </Link>
              </li>
              <li>
                <Link
                  href="/register"
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Регистрация
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900">
              Преподавателям
            </h4>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href="/register"
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Начать преподавать
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900">Компания</h4>
            <ul className="mt-3 space-y-2">
              <li>
                <a href="#" className="text-sm text-gray-500 hover:text-gray-700">
                  О нас
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-500 hover:text-gray-700">
                  Контакты
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-500 hover:text-gray-700">
                  Политика конфиденциальности
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-200 pt-6 text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear()} КлассМаркет. Все права защищены.
        </div>
      </div>
    </footer>
  );
}
