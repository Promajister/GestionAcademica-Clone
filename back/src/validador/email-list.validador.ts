import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function IsEmailList(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'IsEmailList',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (value === undefined || value === null || value === '') return true;
          if (typeof value !== 'string') return false;
          const parts = value
            .split(/[;,]/)
            .map((v) => v.trim())
            .filter((v) => v !== '');
          if (!parts.length) return true;
          return parts.every((email) => EMAIL_REGEX.test(email));
        },
      },
    });
  };
}
