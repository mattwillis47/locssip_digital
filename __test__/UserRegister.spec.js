const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');

beforeAll(() => {
  return sequelize.sync();
});

beforeEach(() => {
  return User.destroy({ truncate: true });
});

const validUser = {
  username: 'user1',
  email: 'user1@mail.com',
  password: 'P4sswordkohsaohi&&BjkdbkKGD122',
  role: 'central line inserter',
};

const postUser = (user = validUser) => {
  return request(app).post('/api/1.0/users/').send(user);
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

  it('it saves the username and email to DB', async () => {
    await postUser();
    // query user table to see if the user exists with username user1
    const userList = await User.findAll();
    const savedUser = userList[0];
    expect(savedUser.username).toBe('user1');
    expect(savedUser.email).toBe('user1@mail.com');
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

  

  it.each`
    field         | value                      | expectedMessage
    ${'username'} | ${null}                    | ${'Username cannot be null'}
    ${'username'} | ${'usr'}                   | ${'Username must be at least 4 and at most 32 characters'}
    ${'username'} | ${'a'.repeat(33)}          | ${'Username must be at least 4 and at most 32 characters'}
    ${'email'}    | ${null}                    | ${'Email cannot be null'}
    ${'email'}    | ${'mail.com'}              | ${'Email is not valid'}
    ${'email'}    | ${'usr.mail.com'}          | ${'Email is not valid'}
    ${'email'}    | ${'user@mail'}             | ${'Email is not valid'}
    ${'password'} | ${null}                    | ${'Password cannot be null'}
    ${'password'} | ${'P4ssw'}                 | ${'Password must be at least 8 and at most 50 characters'}
    ${'password'} | ${'P4ssw'.repeat(12)}      | ${'Password must be at least 8 and at most 50 characters'}
    ${'password'} | ${'alllowercase'}          | ${'Password must include at least 1 lowercase, 1 uppercase, 1 number, and 1 symbol'}
    ${'password'} | ${'INappropriatePassword'} | ${'Password must include at least 1 lowercase, 1 uppercase, 1 number, and 1 symbol'}
    ${'password'} | ${'1'.repeat(43)}          | ${'Password must include at least 1 lowercase, 1 uppercase, 1 number, and 1 symbol'}
  `('it returns $expectedMessage when $field is $value', async ({ field, value, expectedMessage }) => {
    const user = {
      username: 'user1',
      email: 'user1@mail.com',
      password: 'P4ssword',
    };
    user[field] = value;
    const response = await postUser(user);
    const body = response.body;
    expect(body.validationErrors[field]).toBe(expectedMessage);
  });


  it('returns email in use when same email is already in use', async () => {
    await User.create({ ...validUser });
    const response = await postUser();
    expect(response.body.validationErrors.email).toBe('Email in use');
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
});
