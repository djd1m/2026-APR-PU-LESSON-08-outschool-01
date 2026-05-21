import Link from 'next/link';

const features = [
  {
    title: 'Разнообразие',
    description:
      'Более 500 предметов: от математики до робототехники, от рисования до программирования.',
    icon: '📚',
  },
  {
    title: 'Качество',
    description:
      'Проверенные преподаватели с рейтингом и отзывами от реальных родителей.',
    icon: '⭐',
  },
  {
    title: 'Удобство',
    description:
      'Гибкое расписание, онлайн-формат, запись и оплата в пару кликов.',
    icon: '🖥️',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="container-page flex items-center justify-between h-16">
          <Link href="/" className="text-xl font-bold text-primary-600">
            КлассМаркет
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/classes"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Каталог
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
            >
              Войти
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center bg-gradient-to-br from-primary-50 to-white py-20">
        <div className="container-page text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900">
            Живые онлайн-классы
            <br />
            <span className="text-primary-600">для ваших детей</span>
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-gray-600">
            Найдите идеальные занятия среди сотен предметов. Проверенные
            преподаватели, удобное расписание, безопасная онлайн-среда.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/classes"
              className="rounded-lg bg-primary-600 px-8 py-3 text-base font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
            >
              Найти занятие
            </Link>
            <Link
              href="/register"
              className="rounded-lg border border-gray-300 px-8 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Для учителей
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="container-page">
          <h2 className="text-3xl font-bold text-center text-gray-900">
            Почему КлассМаркет?
          </h2>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-gray-100 p-8 text-center hover:shadow-lg transition-shadow"
              >
                <div className="text-4xl">{feature.icon}</div>
                <h3 className="mt-4 text-xl font-semibold text-gray-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary-600">
        <div className="container-page text-center">
          <h2 className="text-3xl font-bold text-white">
            Начните учиться уже сегодня
          </h2>
          <p className="mt-4 text-lg text-primary-100">
            Зарегистрируйтесь бесплатно и получите доступ к каталогу занятий.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-block rounded-lg bg-white px-8 py-3 text-base font-semibold text-primary-600 shadow-sm hover:bg-gray-50 transition-colors"
          >
            Создать аккаунт
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="container-page text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} КлассМаркет. Все права защищены.
        </div>
      </footer>
    </div>
  );
}
