/**
 * ZAMANLI - Auth Helpers Tests
 */

const { expect } = require('chai');
const authHelpers = require('../auth-helpers');

describe('Auth Helpers', () => {
    describe('hashPin', () => {
        it('should hash a valid PIN', async () => {
            const pin = '1234';
            const hashedPin = await authHelpers.hashPin(pin);
            
            expect(hashedPin).to.be.a('string');
            expect(hashedPin).to.have.lengthOf.at.least(20);
            expect(hashedPin).to.include('$2a$'); // bcrypt format
        });
        
        it('should reject PIN shorter than 4 digits', async () => {
            const pin = '123';
            
            try {
                await authHelpers.hashPin(pin);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('4-6 haneli');
            }
        });
        
        it('should reject PIN longer than 6 digits', async () => {
            const pin = '1234567';
            
            try {
                await authHelpers.hashPin(pin);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('4-6 haneli');
            }
        });
    });
    
    describe('verifyPin', () => {
        it('should verify correct PIN', async () => {
            const pin = '1234';
            const hashedPin = await authHelpers.hashPin(pin);
            
            const isValid = await authHelpers.verifyPin(pin, hashedPin);
            
            expect(isValid).to.be.true;
        });
        
        it('should reject incorrect PIN', async () => {
            const pin = '1234';
            const wrongPin = '5678';
            const hashedPin = await authHelpers.hashPin(pin);
            
            const isValid = await authHelpers.verifyPin(wrongPin, hashedPin);
            
            expect(isValid).to.be.false;
        });
        
        it('should handle numeric PIN as string', async () => {
            const pin = 1234;
            const hashedPin = await authHelpers.hashPin(pin.toString());
            
            const isValid = await authHelpers.verifyPin(pin, hashedPin);
            
            expect(isValid).to.be.true;
        });
    });
});
