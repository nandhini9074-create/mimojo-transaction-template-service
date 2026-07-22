import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ErrorMessages } from 'src/common/errors/error-messages';
import { JwtPayload } from './jwt-payload.dto';

@Injectable()
export class AuthHeaderService {
  constructor() {}
  
  async getUserId(authHeader: string): Promise<any> {
    if (!authHeader) {
      throw new HttpException(ErrorMessages.auth.missingAuthHeader, HttpStatus.UNAUTHORIZED);
    }
    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token) {
      throw new HttpException(ErrorMessages.auth.invalidAuthHeader, HttpStatus.UNAUTHORIZED);
    }
    const payload = (await jwt.decode(token)) as JwtPayload;
    if (payload?.user) {
      return payload.user.id;
    } else {
      throw new HttpException(ErrorMessages.auth.invalidToken, HttpStatus.UNAUTHORIZED);
    }
  }
  
  async getUserPreferredLanguage(authHeader: string): Promise<any> {
    if (!authHeader) {
      throw new HttpException(ErrorMessages.auth.missingAuthHeader, HttpStatus.UNAUTHORIZED);
    }
    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token) {
      throw new HttpException(ErrorMessages.auth.invalidAuthHeader, HttpStatus.UNAUTHORIZED);
    }
    const payload = (await jwt.decode(token)) as JwtPayload;
    if (payload?.user) {
      return payload.user.preferredLanguage ?? 'en';
    } else {
      throw new HttpException(ErrorMessages.auth.invalidToken, HttpStatus.UNAUTHORIZED);
    }
  }
}
