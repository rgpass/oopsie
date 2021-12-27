import { decode } from 'jsonwebtoken';
import setCookie from 'set-cookie-parser';
import request from 'supertest';

import app from '../../app';
import { UserService } from '../../services';
import * as service from '../../services/verifyMobile.service';
import { userBuilder } from '../../testHelpers';
import { formatPhoneNumber } from '../../utils';

beforeEach(async () => {
  const mockedStart = jest.spyOn(service, 'startVerification');
  const mockedCheck = jest.spyOn(service, 'checkVerification');

  mockedStart.mockResolvedValue({ status: 'success' });
  mockedCheck.mockResolvedValue({ status: 'success' });
});

describe('POST api/auth/signup', () => {
  describe('signup then log in with a valid token', () => {
    it('returns 200, token and Info', async () => {
      const newUser = userBuilder();
      const response = await request(app)
        .post('/api/auth/signup')
        .send(newUser)
        .expect(200);

      const returned = response.body;

      expect(returned.email).toBe(newUser.email.toLowerCase());
      expect(returned.mobile).toBe(formatPhoneNumber(newUser.mobile));
      expect(returned.verifiedMobile).toBe(false);
      expect(response.body.password).toBeUndefined();
      expect(response.body.pin).toBeUndefined();

      const verifyRequest = {
        email: newUser.email,
        mobile: newUser.mobile,
        code: '123456',
      };

      const verified = await request(app)
        .post('/api/auth/verify')
        .send(verifyRequest)
        .set('Accept', 'application/json')
        .expect(200);

      const { body, headers } = verified;

      const cookie = setCookie.parse(headers['set-cookie'], {
        decodeValues: true,
        map: true,
      });

      expect(cookie.accessToken.httpOnly).toBe(true);
      // eslint-disable-next-line jest/valid-expect
      expect(cookie.accessToken.expires).toBeDefined;

      const accessToken = cookie.accessToken.value;

      const payload = decode(accessToken, {
        complete: true,
      })?.payload;

      const now = new Date().getSeconds();

      expect(payload?.email).toBe(newUser.email.toLowerCase());
      expect(payload?.mobile).toBe(formatPhoneNumber(newUser.mobile));
      expect(payload?.verifiedMobile).toBe(true);
      expect(payload?.aud).toBe('myPhone');
      expect(payload?.roles[0]).toBe('user');
      expect(payload?.exp).toBeGreaterThan(now);

      expect(body.verifiedMobile).toBe(true);

      expect(body.email).toBe(newUser.email.toLowerCase());

      await request(app)
        .get('/api/user')
        .set('Cookie', `accessToken=${accessToken}`)
        .set('Authorization', accessToken)
        .send()
        .expect(200);
    });
  });

  describe('invalid token to GET /user', () => {
    it('returns a 401 forbidden', async () => {
      const newUser = userBuilder();

      await request(app).post('/api/auth/signup').send(newUser).expect(200);

      await request(app)
        .get('/api/user')
        .set('Authorization', 'sldkfj')
        .expect(401);
    });
  });

  describe('email already has an account', () => {
    const newUser = userBuilder();
    const message = 'User Already Exists. Please Sign In';

    it('returns 409 with notification', async () => {
      await request(app).post('/api/auth/signup').send(newUser).expect(200);

      const response = await request(app)
        .post('/api/auth/signup')
        .send(newUser)
        .expect(409);

      expect(response.body).toBe(message);
    });
  });
});

describe('POST NEW /api/auth/signin', () => {
  describe('with correct creds', () => {
    it('creates a new token and logs in user', async () => {
      const newUser = {
        ...userBuilder(),
        verifiedMobile: true,
      };

      await UserService.create({
        ...newUser,
      });

      const response = await request(app)
        .post('/api/auth/signin')
        .send({ email: newUser.email, password: newUser.password })
        .expect(200);

      const { headers } = response;

      const cookie = setCookie.parse(headers['set-cookie'], {
        decodeValues: true,
        map: true,
      });

      expect(cookie.accessToken.httpOnly).toBe(true);
      // eslint-disable-next-line jest/valid-expect
      expect(cookie.accessToken.expires).toBeDefined;

      const accessToken = cookie.accessToken.value;

      const payload = decode(accessToken, {
        complete: true,
      })?.payload;

      expect(payload?.email).toBe(newUser.email.toLowerCase());

      await request(app)
        .get('/api/user')
        .set('Cookie', `accessToken=${accessToken}`)
        .set('Authorization', accessToken)
        .send()
        .expect(200);
    });
  });

  describe('missing password', () => {
    it('returns back a 400', async () => {
      const newUser = userBuilder();

      await request(app).post('/api/auth/signup').send(newUser).expect(200);

      await request(app)
        .post('/api/auth/signin')
        .type('form')
        .send({ email: newUser.email })
        .expect(400);
    });
  });

  describe('incorrect creds', () => {
    const user = userBuilder();
    const message = 'Account not Found';

    it('returns 400 with message', async () => {
      await request(app).post('/api/auth/signup').send(user).expect(200);

      const credentials = { email: 'wrong@wrong.com', password: user.password };
      const response = await request(app)
        .post('/api/auth/signin')
        .send(credentials)
        .expect(400);

      expect(response.body).toBe(message);
    });
  });

  // describe('expired token', () => {
  //   test('return 401 unauthorized');
  // });
});

// Expired Token
// "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiY2t0cmtiNTI5MDAwMjhkbG9jaG9scHlnbSIsImVtYWlsIjoiZGF2aWR0aG9tYXNvbjAwQGdtYWlsLmNvbSIsImlhdCI6MTYzMjExMjAzNiwiZXhwIjoxNjMyMTE5MjM2fQ.so4moVGWBouIMNQhtTbijGXheXfcJxTZjb8E-RHhMSE"

// TODO: determine if any of this is necessary by researching how refreshing tokens works
// describe('valid token');
// describe('invalid token');
// describe('expired token');
// describe('token renewal request');