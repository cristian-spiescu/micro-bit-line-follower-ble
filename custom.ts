namespace maqueen {
    export enum Motors { M1 = 0, M2 = 1, All = 2 }
    export enum Dir { CW = 0x0, CCW = 0x1 }
    export enum Patrol { PatrolLeft = 13, PatrolRight = 14 }

    export function motorRun(index: Motors, direction: Dir, speed: number) {
        let buf = control.createBuffer(3)
        buf[1] = direction
        buf[2] = speed
        if (index == 0) {
            buf[0] = 0
            pins.i2cWriteBuffer(0x10, buf)
        } else if (index == 1) {
            buf[0] = 2
            pins.i2cWriteBuffer(0x10, buf)
        } else if (index == 2) {
            buf[0] = 0
            pins.i2cWriteBuffer(0x10, buf)
            buf[0] = 2
            pins.i2cWriteBuffer(0x10, buf)
        }
        
    }

    export function readPatrol(patrol: Patrol): number {
        if (patrol == Patrol.PatrolLeft) {
            return pins.digitalReadPin(DigitalPin.P13)
        } else if (patrol == Patrol.PatrolRight) {
            return pins.digitalReadPin(DigitalPin.P14)
        } else {
            return -1
        }
    }

}