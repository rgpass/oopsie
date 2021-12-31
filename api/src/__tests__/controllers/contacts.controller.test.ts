import { times } from 'lodash';
import request from 'supertest';

import app from '../../app';
import { sortArray } from '../../lib';
import db from '../../lib/db';
import { UserService } from '../../services';
import * as service from '../../services/verifyMobile.service';
import { contactBuilder, userBuilder, getAccessToken } from '../../testHelpers';

beforeEach(async () => {
  const mockedStart = jest.spyOn(service, 'startVerification');
  const mockedCheck = jest.spyOn(service, 'checkVerification');

  mockedStart.mockResolvedValue({ status: 'success' });
  mockedCheck.mockResolvedValue({ status: 'success' });
});

afterAll(async () => {
  await db.$disconnect;
});

describe('POST /api/contacts', () => {
  const newContacts = times(1)
    .map(() => contactBuilder())
    .sort(sortArray);

  test('returns 201 Ok and created contacts', async () => {
    const newUser = {
      ...userBuilder(),
      verifiedMobile: true,
    };

    await UserService.create(newUser);

    const res = await request(app)
      .post('/api/user/signin')
      .send({ mobile: newUser.mobile, pin: newUser.pin })
      .expect(200);

    const { headers } = res;

    const response = await request(app)
      .post('/api/contacts')
      .set('Authorization', getAccessToken(headers))
      .send({ contacts: newContacts })
      .expect(201);

    const contacts = response.body.sort(sortArray);

    const contact1 = contacts[0];
    const phone1 = contact1.phoneNumbers[0];
    const phone2 = contact1.phoneNumbers[1];

    expect(contact1.firstName).toBe(newContacts[0].firstName);
    expect(contact1.lastName).toBe(newContacts[0].lastName);
    expect(phone1.number).toBe(newContacts[0].phoneNumbers[0].number);
    expect(phone2.number).toBe(newContacts[0].phoneNumbers[1].number);
    expect(contact1.phoneNumbers[1]).toMatchObject(
      newContacts[0].phoneNumbers[1],
    );

    expect(contacts.length).toBe(1);
  });
});

describe('GET /api/contacts', () => {
  const user1Contacts = times(2)
    .map(() => contactBuilder())
    .sort(sortArray);
  const user2Contacts = times(1)
    .map(() => contactBuilder())
    .sort(sortArray);

  test('returns 200 Ok with user contacts', async () => {
    const newUser1 = {
      ...userBuilder(),
      verifiedMobile: true,
    };

    await UserService.create(newUser1);

    const newUser2 = {
      ...userBuilder(),
      verifiedMobile: true,
    };

    await UserService.create(newUser2);

    const res1 = await request(app)
      .post('/api/user/signin')
      .send({ mobile: newUser1.mobile, pin: newUser1.pin })
      .expect(200);

    const res2 = await request(app)
      .post('/api/user/signin')
      .send({ mobile: newUser2.mobile, pin: newUser2.pin })
      .expect(200);

    await request(app)
      .post('/api/contacts')
      .set('Authorization', getAccessToken(res1.headers))
      .send({ contacts: user1Contacts })
      .expect(201);

    await request(app)
      .post('/api/contacts')
      .set('Authorization', getAccessToken(res2.headers))
      .send({ contacts: user2Contacts })
      .expect(201);

    const user1Res = await request(app)
      .get('/api/contacts')
      .set('Authorization', getAccessToken(res1.headers))
      .send({ contacts: user1Contacts })
      .expect(200);

    const user2Res = await request(app)
      .get('/api/contacts')
      .set('Authorization', getAccessToken(res2.headers))
      .send({ contacts: user2Contacts })
      .expect(200);

    const user1List = user1Res.body.sort(sortArray);
    const user2List = user2Res.body.sort(sortArray);

    expect(user1List.length).toBe(2);
    expect(user1List[0]).toMatchObject(user1Contacts[0]);
    expect(user2List[0]).toMatchObject(user2Contacts[0]);
    expect(user2List.length).toBe(1);
  });
});
