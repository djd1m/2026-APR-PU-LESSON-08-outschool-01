import { Job } from 'bullmq';
import nodemailer from 'nodemailer';
import type { EmailJobData, EmailJobType } from '../queues';

const SMTP_HOST = process.env.SMTP_HOST || 'localhost';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '1025', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const MAIL_FROM = process.env.MAIL_FROM || 'КлассМаркет <noreply@klassmarket.ru>';

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  ...(SMTP_USER && SMTP_PASS
    ? { auth: { user: SMTP_USER, pass: SMTP_PASS } }
    : {}),
});

interface EmailTemplate {
  subject: string;
  html: string;
}

function buildTemplate(type: EmailJobType, payload: Record<string, unknown>): EmailTemplate {
  switch (type) {
    case 'welcome':
      return {
        subject: 'Добро пожаловать в КлассМаркет!',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Добро пожаловать!</h1>
            <p>Здравствуйте, ${payload.name || 'пользователь'}!</p>
            <p>Вы успешно зарегистрировались на КлассМаркет — маркетплейсе живых онлайн-классов для детей.</p>
            <p>Начните поиск идеальных занятий прямо сейчас.</p>
            <a href="${payload.dashboardUrl || 'https://klassmarket.ru/dashboard'}"
               style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; margin-top: 16px;">
              Перейти в личный кабинет
            </a>
          </div>
        `,
      };

    case 'booking-confirmation':
      return {
        subject: `Запись подтверждена: ${payload.classTitle || 'занятие'}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Запись подтверждена!</h1>
            <p>Вы записались на занятие <strong>${payload.classTitle}</strong>.</p>
            <p><strong>Преподаватель:</strong> ${payload.teacherName || '—'}</p>
            <p><strong>Дата:</strong> ${payload.date || '—'}</p>
            <p><strong>Время:</strong> ${payload.time || '—'}</p>
            <p>Ссылка на занятие будет отправлена за 15 минут до начала.</p>
          </div>
        `,
      };

    case 'class-reminder':
      return {
        subject: `Напоминание: ${payload.classTitle || 'занятие'} через ${payload.minutesBefore || 15} мин`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Скоро начало!</h1>
            <p>Занятие <strong>${payload.classTitle}</strong> начнётся через ${payload.minutesBefore || 15} минут.</p>
            ${payload.meetingUrl ? `<a href="${payload.meetingUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; margin-top: 16px;">Присоединиться</a>` : ''}
          </div>
        `,
      };

    case 'payout-complete':
      return {
        subject: 'Выплата обработана',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Выплата выполнена</h1>
            <p>На ваш счёт переведено <strong>${payload.amount || 0} &#8381;</strong>.</p>
            <p>Средства поступят в течение 1-3 рабочих дней.</p>
          </div>
        `,
      };

    default: {
      const _exhaustive: never = type;
      throw new Error(`Unknown email type: ${_exhaustive}`);
    }
  }
}

export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { type, to, payload } = job.data;

  console.log(`[email] sending "${type}" to ${to}`);

  const template = buildTemplate(type, payload);

  await transporter.sendMail({
    from: MAIL_FROM,
    to,
    subject: template.subject,
    html: template.html,
  });

  console.log(`[email] sent "${type}" to ${to}`);
}
