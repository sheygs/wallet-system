import { format, transports } from 'winston';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';

const { combine, printf } = format;

const formatOptions = {
  format: combine(
    process.env.NODE_ENV !== 'production' ? format.simple() : format.json(),

    printf((info) => {
      const today = new Date();
      const timestamp = `${
        today.toISOString().split('T')[0]
      } ${today.toLocaleTimeString()}`;
      return `${timestamp} ${info.level}: ${info.message}`;
    }),
  ),
};

const options = {
  error: {
    level: 'error',
    filename: `${process.cwd()}/logs/error.log`,
    handleExceptions: true,
    maxsize: 5242880,
    maxFiles: 5,
    colorize: false,
  },
  combined: {
    level: 'info',
    filename: `${process.cwd()}/logs/app.log`,
    handleExceptions: true,
    maxsize: 5242880,
    maxFiles: 5,
    colorize: false,
  },
  console: {
    level: 'debug',
    handleExceptions: true,
    json: false,
    colorize: true,
  },
};

const winstonLogger = {
  ...formatOptions,
  transports: [
    new transports.Console({
      format: format.combine(
        format.timestamp(),
        format.ms(),
        nestWinstonModuleUtilities.format.nestLike(),
      ),
      ...options.console,
    }),

    new transports.File(options.combined),
    new transports.File(options.error),
  ],
};

export default winstonLogger;
