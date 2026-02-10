/**
 * ZAMANLI - Package Limiter Tests
 */

const { expect } = require('chai');
const test = require('firebase-functions-test')();
const admin = require('firebase-admin');

describe('Package Limiter', () => {
    let myFunctions;
    
    before(() => {
        // Initialize functions
        myFunctions = require('../package-limiter');
    });
    
    after(() => {
        test.cleanup();
    });
    
    describe('PACKAGE_LIMITS', () => {
        it('should have correct free package limits', () => {
            const limits = myFunctions.PACKAGE_LIMITS;
            
            expect(limits.free.monthlyAppointments).to.equal(30);
            expect(limits.free.maxStaff).to.equal(1);
        });
        
        it('should have unlimited appointments for pro package', () => {
            const limits = myFunctions.PACKAGE_LIMITS;
            
            expect(limits.pro.monthlyAppointments).to.equal(-1);
            expect(limits.pro.maxStaff).to.equal(5);
        });
        
        it('should have unlimited for business package', () => {
            const limits = myFunctions.PACKAGE_LIMITS;
            
            expect(limits.business.monthlyAppointments).to.equal(-1);
            expect(limits.business.maxStaff).to.equal(-1);
        });
    });
    
    describe('checkAppointmentLimit', () => {
        it('should exist as a function', () => {
            expect(myFunctions.checkAppointmentLimit).to.be.a('function');
        });
        
        // TODO: Add mock tests with firebase-functions-test
        // Bu testler gerçek Firestore bağlantısı gerektirdiğinden
        // emulator ile test edilmeli
    });
    
    describe('checkStaffLimit', () => {
        it('should exist as a function', () => {
            expect(myFunctions.checkStaffLimit).to.be.a('function');
        });
    });
});
