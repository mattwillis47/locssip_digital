const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');
// const nodeMailerStub = require('nodemailer-stub');
// const EmailService = require('../src/email/EmailService');
const SMTPServer = require('smtp-server').SMTPServer;

let lastMail, server;
let simulateSmtpFailure = false;

beforeAll(async () => {
  server = new SMTPServer({
    authOptional: true,
    onData(stream, session, callback) {
      let mailBody;
      stream.on('data', (data) => {
        mailBody += data.toString();
      });
      stream.on('end', () => {
        if (simulateSmtpFailure) {
          const err = new Error('Invalid mailbox');
          err.responseCode = 553;
          return callback(err);
        }
        lastMail = mailBody;
        callback();
      });
    },
  });

  await server.listen(8587, 'localhost');

  jest.setTimeout(20000);

  await sequelize.sync();
});

beforeEach(() => {
  simulateSmtpFailure = false;
  return User.destroy({ truncate: true });
});

afterAll(async () => {
  await server.close();
  jest.setTimeout(5000);
});

const validUser = {
  username: 'user1',
  email: 'pansy75@ethereal.email',
  password: 'P4sswordkohsaohi&&BjkdbkKGD122',
  role: 'central line inserter',
};

const postUser = (user = validUser, options = {}) => {
  const agent = request(app).post('/api/1.0/users/');
  if (options.language) {
    agent.set('Accept-Language', options.language);
  }

  return agent.send(user);
};

describe('User Registration', () => {
  it('returns 200 OK when sign up request is valid', async () => {
    const response = await postUser();
    expect(response.status).toBe(200);
  });

  it('returns success message when signup request is valid', async () => {
    const response = await postUser();
    expect(response.body.message).toBe('User created');
  });

  it('saves the user to the database', async () => {
    await postUser();
    // query user table to see if the user exists with username user1
    const userList = await User.findAll();
    expect(userList.length).toBe(1);
  });

  it('saves the username and email to DB', async () => {
    await postUser();
    // query user table to see if the user exists with username user1
    const userList = await User.findAll();
    const savedUser = userList[0];
    expect(savedUser.username).toBe('user1');
    expect(savedUser.email).toBe('pansy75@ethereal.email');
  });

  it('hashes the password in DB', async () => {
    await postUser();
    // query user table to see if the user exists with username user1
    const userList = await User.findAll();
    const savedUser = userList[0];
    expect(savedUser.password).not.toBe('P4ssword');
  });

  it('returns 400 when username is null', async () => {
    const response = await postUser({
      username: null,
      email: 'user1@mail.com',
      password: 'P4ssword',
      role: 'central line inserter',
    });
    expect(response.status).toBe(400);
  });

  it('returns validationErrors field in response when validation error occurs', async () => {
    const response = await postUser({
      username: null,
      email: 'user1@mail.com',
      password: 'P4ssword',
      role: 'central line inserter',
    });
    const body = response.body;
    expect(body.validationErrors).not.toBeUndefined();
  });

  it('returns errors for both when email and username is null', async () => {
    const response = await postUser({
      username: null,
      email: null,
      password: 'P4sswordnklfndslkhfnjksbjkfbjksbHBHVD8jb?',
      role: 'central line inserter',
    });
    const body = response.body;

    expect(Object.keys(body.validationErrors)).toEqual(['username', 'email']);
  });

  const username_null = 'Username cannot be null';
  const username_size = 'Username must be at least 4 and at most 32 characters';
  const email_null = 'Email cannot be null';
  const email_invalid = 'Email is not valid';
  const password_null = 'Password cannot be null';
  const password_size = 'Password must be at least 8 and at most 50 characters';
  const password_pattern = 'Password must include at least 1 lowercase, 1 uppercase, 1 number, and 1 symbol';
  const email_in_use = 'Email in use';

  it.each`
    field         | value                      | expectedMessage
    ${'username'} | ${null}                    | ${username_null}
    ${'username'} | ${'usr'}                   | ${username_size}
    ${'username'} | ${'a'.repeat(33)}          | ${username_size}
    ${'email'}    | ${null}                    | ${email_null}
    ${'email'}    | ${'mail.com'}              | ${email_invalid}
    ${'email'}    | ${'usr.mail.com'}          | ${email_invalid}
    ${'email'}    | ${'user@mail'}             | ${email_invalid}
    ${'password'} | ${null}                    | ${password_null}
    ${'password'} | ${'P4ssw'}                 | ${password_size}
    ${'password'} | ${'P4ssw'.repeat(12)}      | ${password_size}
    ${'password'} | ${'alllowercase'}          | ${password_pattern}
    ${'password'} | ${'INappropriatePassword'} | ${password_pattern}
    ${'password'} | ${'1'.repeat(43)}          | ${password_pattern}
  `(`it returns $expectedMessage when $field is $value`, async ({ field, expectedMessage, value }) => {
    const user = {
      username: 'user1',
      email: 'pansy75@ethereal.email',
      password: 'P4ssword',
    };
    user[field] = value;
    const response = await postUser(user);
    const body = response.body;
    expect(body.validationErrors[field]).toBe(expectedMessage);
  });

  it(`returns ${email_in_use} when same email is already in use`, async () => {
    await User.create({ ...validUser });
    const response = await postUser({ ...validUser }, { language: 'en' });
    expect(response.body.validationErrors.email).toBe(email_in_use);
  });

  it('returns errors for both username is null and email is in use', async () => {
    await User.create({ ...validUser });
    const response = await postUser({
      username: null,
      email: validUser.email,
      password: 'P4sswo^^bjdkbkjdkdrd',
    });
    const body = response.body;
    expect(Object.keys(body.validationErrors)).toEqual(['username', 'email']);
  });

  it('creates user in inactive mode', async () => {
    await postUser();
    const user = await User.findAll();
    const savedUser = user[0];
    expect(savedUser.inactive).toBe(true);
  });

  it('creates user in inactive mode even if the request body contains inactive mode', async () => {
    const newUser = { ...validUser, inactive: false };
    await postUser(newUser);
    const user = await User.findAll();
    const savedUser = user[0];
    expect(savedUser.inactive).toBe(true);
  });

  it('creates user in activation token for user', async () => {
    await postUser();
    const user = await User.findAll();
    const savedUser = user[0];
    expect(savedUser.activationToken).toBeTruthy();
  });

  it('sends an account activation email with activation token', async () => {
    await postUser();

    const users = await User.findAll();
    const savedUser = users[0];
    expect(lastMail).toContain('pansy75@ethereal.email');
    expect(lastMail).toContain(savedUser.activationToken);
  });

  it('returns 502 Bad Gateway when sending email fails', async () => {
    simulateSmtpFailure = true;
    const repsonse = await postUser();
    expect(repsonse.status).toBe(502);
  });

  it('returns email failure message when sending email fails', async () => {
    simulateSmtpFailure = true;
    const repsonse = await postUser();
    expect(repsonse.body.message).toBe('Email failure');
  });

  it('does not save user to DB if activation email fails', async () => {
    simulateSmtpFailure = true;
    await postUser();
    const users = await User.findAll();
    expect(users.length).toBe(0);
  });

  it('returns validation failure message in error response bpdy when validation fails', async () => {
    const response = await postUser({
      username: null,
      email: validUser.email,
      password: 'P4sswo^^bjdkbkjdkdrd',
    });
    expect(response.body.message).toBe('Validation failure');
  });

  describe('Internationalisation', () => {
    const username_null = 'لا يمكن أن يكون اسم المستخدم فارغًا';
    const username_size = 'يجب ألا يقل اسم المستخدم عن 4 أحرف ولا يزيد عن 32 حرفًا';
    const email_null = 'لا يمكن أن يكون البريد الإلكتروني فارغًا';
    const email_invalid = 'البريد الإلكتروني غير صالح';
    const password_null = 'لا يمكن أن تكون كلمة المرور فارغة';
    const password_size = 'يجب ألا تقل كلمة المرور عن 8 أحرف ولا تزيد عن 50 حرفًا';
    const password_pattern =
      'يجب أن تتضمن كلمة المرور حرفًا صغيرًا واحدًا وحرفًا كبيرًا ورقمًا واحدًا ورمزًا واحدًا على الأقل';
    const email_in_use = 'البريد الإلكتروني قيد الاستخدام';
    const user_create_success = 'تم إنشاء المستخدم';
    const email_failure = 'فشل إرسال البريد الإلكتروني';
    const validation_failure = 'فشل التحقق من الصحة';

    it.each`
      field         | value                      | expectedMessage
      ${'username'} | ${null}                    | ${username_null}
      ${'username'} | ${'usr'}                   | ${username_size}
      ${'username'} | ${'a'.repeat(33)}          | ${username_size}
      ${'email'}    | ${null}                    | ${email_null}
      ${'email'}    | ${'mail.com'}              | ${email_invalid}
      ${'email'}    | ${'usr.mail.com'}          | ${email_invalid}
      ${'email'}    | ${'user@mail'}             | ${email_invalid}
      ${'password'} | ${null}                    | ${password_null}
      ${'password'} | ${'P4ssw'}                 | ${password_size}
      ${'password'} | ${'P4ssw'.repeat(12)}      | ${password_size}
      ${'password'} | ${'alllowercase'}          | ${password_pattern}
      ${'password'} | ${'INappropriatePassword'} | ${password_pattern}
      ${'password'} | ${'1'.repeat(43)}          | ${password_pattern}
    `(
      'it returns $expectedMessage when $field is $value when language is set as arabic',
      async ({ field, value, expectedMessage }) => {
        const user = {
          username: 'user1',
          email: 'user1@mail.com',
          password: 'P4ssword',
        };
        user[field] = value;
        const response = await postUser(user, { language: 'ar' });
        const body = response.body;
        expect(body.validationErrors[field]).toBe(expectedMessage);
      }
    );

    it(`returns ${email_in_use} when same email is already in use when language is set as arabic`, async () => {
      await User.create({ ...validUser });
      const response = await postUser({ ...validUser }, { language: 'ar' });
      expect(response.body.validationErrors.email).toBe(email_in_use);
    });

    it(`returns success message of ${user_create_success} when signup request is valid and language is set as arabic`, async () => {
      const response = await postUser({ ...validUser }, { language: 'ar' });
      expect(response.body.message).toBe(user_create_success);
    });

    it(`returns ${email_failure} message when sending email fails in arabic`, async () => {
      simulateSmtpFailure = true;
      const repsonse = await postUser({ ...validUser }, { language: 'ar' });
      expect(repsonse.body.message).toBe(email_failure);
    });

    it(`returns ${validation_failure} failure message in error response bpdy when validation fails in arabic`, async () => {
      const response = await postUser(
        {
          username: null,
          email: validUser.email,
          password: 'P4sswo^^bjdkbkjdkdrd',
        },
        { language: 'ar' }
      );
      expect(response.body.message).toBe(validation_failure);
    });
  });
  describe('Account Activation', () => {
    it('activates the accouint when correct token is sent', async () => {
      await postUser();
      let users = await User.findAll();
      const token = users[0].activationToken;

      await request(app).post(`/api/1.0/users/token/${token}`).send();
      users = await User.findAll();
      expect(users[0].inactive).toBe(false);
    });
    it('removes the token from user table after successful activation', async () => {
      await postUser();
      let users = await User.findAll();
      const token = users[0].activationToken;

      await request(app).post(`/api/1.0/users/token/${token}`).send();
      users = await User.findAll();
      expect(users[0].activationToken).toBeFalsy();
    });
    it('does not activate the account when token is wrong', async () => {
      await postUser();
      const token = 'wrong-token';

      await request(app).post(`/api/1.0/users/token/${token}`).send();
      const users = await User.findAll();
      expect(users[0].inactive).toBe(true);
    });

    it('returns bad request (400) when token is wroing', async () => {
      await postUser();
      const token = 'wrong-token';
      const response = await request(app).post(`/api/1.0/users/token/${token}`).send();
      expect(response.status).toBe(400);
    });

    it.each`
      language | tokenStatus  | message
      ${'ar'}  | ${'wrong'}   | ${'رمز التنشيط غير صالح'}
      ${'en'}  | ${'wrong'}   | ${'Activation token is not valid'}
      ${'ar'}  | ${'correct'} | ${'تم تنشيط الحساب'}
      ${'en'}  | ${'correct'} | ${'Account activated'}
    `(
      'return $message when token is $tokenStatus and language is $language',
      async ({ language, tokenStatus, message }) => {
        await postUser();
        let token = 'wrong-token';
        if (tokenStatus === 'correct') {
          let users = await User.findAll();
          token = users[0].activationToken;
        }
        const response = await request(app)
          .post(`/api/1.0/users/token/${token}`)
          .set('Accept-Language', language)
          .send();
        expect(response.body.message).toBe(message);
      }
    );
  });
});
describe('Error Model', () => {
  it('returns path, timestamp, message and validationErrors in response when  there is validation failure', async () => {
    const response = await postUser({ ...validUser, username: null });
    const body = response.body;
    expect(Object.keys(body)).toEqual(['path', 'timestamp', 'message', 'validationErrors']);
  });
  it('returns path, timestamp and emssage in response when request fails other than validation error', async () => {
    const token = 'wrong-token';
    const response = await request(app).post(`/api/1.0/users/token/${token}`).send();
    const body = response.body;
    expect(Object.keys(body)).toEqual(['path', 'timestamp', 'message']);
  });
  it('returns path in error body', async () => {
    const token = 'wrong-token';
    const response = await request(app).post(`/api/1.0/users/token/${token}`).send();
    const body = response.body;
    expect(body.path).toEqual(`/api/1.0/users/token/${token}`);
  });
  it('returns timestamp in milliseconds within 5 seconds value in error body', async () => {
    const nowInMillis = new Date().getTime();
    const fiveSecondsLater = nowInMillis + 5 * 1000;
    const token = 'wrong-token';
    const response = await request(app).post(`/api/1.0/users/token/${token}`).send();
    const body = response.body;
    expect(body.timestamp).toBeGreaterThan(nowInMillis);
    expect(body.timestamp).toBeLessThan(fiveSecondsLater);
  });
});
