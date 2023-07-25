const express = require('express');
const router = express.Router();
const UserService = require('./UserService');

router.post('/api/1.0/users', async (req, res) => {
  const user = req.body;
  if (user.username === null) {
    return res.status(400).send({
      validationErrors: {
        username: 'Username cannot be null',
         email: 'Email cannot be null',
      },
    });
  }
  await UserService.save(req.body);
  return res.send({ message: 'User created' });
});

/*
{
    "username": "Username cannot be null",
    "email": "Email cannot be null",
    "password": "Password cannot be null",
}
*/

module.exports = router;

// const user = Object.assign({}, req.body, { password: hash });

// const user = {
//   username: req.body.username,
//   email: req.body.email,
//   password: hash,
// };
