const mongoose = require('mongoose');

const DEVICE_SECRET_PATTERN = /^[a-f0-9]{64}$/i;
const USERNAME_PATTERN = /^[\p{L}\p{N}_ -]{3,20}$/u;
const MAX_PAYLOAD_LENGTH = 65536;
const MAX_CLIENT_MESSAGE_ID_LENGTH = 80;
const DEVICE_ID_PATTERN = /^[a-f0-9]{64}$/i;

const normalizeUsername = (value) => typeof value === 'string'
  ? value.normalize('NFKC').trim().replace(/\s+/g, ' ')
  : '';

const isValidUsername = (value) => USERNAME_PATTERN.test(normalizeUsername(value));
const isValidDeviceSecret = (value) => typeof value === 'string' && DEVICE_SECRET_PATTERN.test(value);
const isValidDeviceId = (value) => typeof value === 'string' && DEVICE_ID_PATTERN.test(value);
const isObjectId = (value) => typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
const isValidPayload = (value) => typeof value === 'string' && value.length > 0 && value.length <= MAX_PAYLOAD_LENGTH;
const isValidClientMessageId = (value) => typeof value === 'string'
  && value.length >= 8
  && value.length <= MAX_CLIENT_MESSAGE_ID_LENGTH
  && /^[a-zA-Z0-9_-]+$/.test(value);

module.exports = {
  MAX_PAYLOAD_LENGTH,
  normalizeUsername,
  isValidUsername,
  isValidDeviceSecret,
  isValidDeviceId,
  isObjectId,
  isValidPayload,
  isValidClientMessageId,
};
