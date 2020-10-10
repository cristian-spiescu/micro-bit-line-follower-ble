enum Command { FWD, BKW, LEFT, RIGHT }

let speed = 100

// in aer = 0
// pe podea alb = 1, negru = 0
let left = -1
let right = -1

let lastLateral: Command;

let running = false
let command = Command.FWD;

const lineFollowFlagMiddle = 10;
let lineFollowFlag = lineFollowFlagMiddle;

const inertiaMax = 20;
let inertia = 0;

// main program
serial.setBaudRate(BaudRate.BaudRate115200);
serial.writeLine("salut1")
bluetooth.startUartService()

// main loop
basic.forever(function on_forever() {
    if (!(running)) {
        return;
    }
    
    const now = control.millis();
    const newLeft = maqueen.readPatrol(maqueen.Patrol.PatrolLeft)
    const newRight = maqueen.readPatrol(maqueen.Patrol.PatrolRight)

    if (command == Command.LEFT || command == Command.RIGHT) {
        lastLateral = command
    }

    let newCommand = command;
    if (command == Command.FWD // going forward
            && newLeft == 1 && newRight == 1) { // and left the track
        if (newLeft != left && (lastLateral == Command.RIGHT || inertia == 0)) {
            // just exited w/ left sensor; so from now on go left to try 
            // to reenter the track
            newCommand = Command.RIGHT
        } else if (newRight != right && (lastLateral == Command.LEFT || inertia == 0)) {
            newCommand = Command.LEFT;
        } else if (inertia > 0) {
            newCommand = lastLateral
        }
    } else { // searching for track
        if (newLeft == 1 && newRight == 1) {
            // still out; so nothing to do
        } else {
            newCommand = Command.FWD;
        } 
    }

    left = newLeft
    right = newRight

    serial.writeLine("cmd=" + lastLateral + ",i=" + inertia);

    if (newCommand == Command.FWD) {
        if (inertia >= 1) { inertia--; }
    } else if (newCommand != Command.BKW) {
        if (inertia < inertiaMax) { inertia++; }
    }

    if (newCommand == command) { return; }
    command = newCommand;

    if (command == Command.FWD) {
        maqueen.motorRun(maqueen.Motors.All, maqueen.Dir.CW, speed)
    } else if (command == Command.BKW) {
        maqueen.motorRun(maqueen.Motors.All, maqueen.Dir.CCW, speed)
    } else if (command == Command.LEFT) {
        maqueen.motorRun(maqueen.Motors.M1, maqueen.Dir.CW, speed)
        maqueen.motorRun(maqueen.Motors.M2, maqueen.Dir.CW, 0)       
    } else if (command == Command.RIGHT) {
        maqueen.motorRun(maqueen.Motors.M1, maqueen.Dir.CW, 0)
        maqueen.motorRun(maqueen.Motors.M2, maqueen.Dir.CW, speed)       
    }

})

input.onButtonPressed(Button.A, function () {
    setRunning(!running)
})

function setRunning(value: boolean) {
    running = value
    left = right = -1
    maqueen.motorRun(maqueen.Motors.All, maqueen.Dir.CW, value ? speed : 0)
}

bluetooth.onBluetoothConnected(function () {
    basic.showString("C")
})

bluetooth.onBluetoothDisconnected(function () {
    basic.showString("D")
})

bluetooth.onUartDataReceived(serial.delimiters(Delimiters.SemiColon), function () {
    const str = bluetooth.uartReadUntil(serial.delimiters(Delimiters.SemiColon));
    if (str == "S") { setRunning(false); } 
    else if (str == "F") { setRunning(true); }
    basic.showString(str);
})


