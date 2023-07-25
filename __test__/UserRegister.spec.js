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
  password: 'P4ssword',
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
});