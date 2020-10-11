enum Command { STOP, FWD, BKW, LEFT, RIGHT, TURN_LEFT, TURN_RIGHT }

let speed = 100

// in aer = 0
// pe podea alb = 1, negru = 0
let left = -1
let right = -1

let lastLateral: Command;

let running = false
let command: Command;

const lineFollowFlagMiddle = 10;
let lineFollowFlag = lineFollowFlagMiddle;

const inertiaMax = 20;
let inertia = 0;

enum TurnState { MOTOR_JUST_STARTED, SECOND_WENT_OFF, FIRST_ON }
let turnState: TurnState;
enum TurnCommand { OFF, TURN_LEFT, TURN_RIGHT };
let turnCommand = TurnCommand.OFF;

let runForDurationStart = 0;
let runForDuration = 0;

// main program
serial.setBaudRate(BaudRate.BaudRate115200);
serial.writeLine("salut1")
bluetooth.startUartService()
sendMotorCommand(Command.STOP, 0);

// main loop
basic.forever(function on_forever() {
    if (runForDuration && control.millis() > runForDurationStart + runForDuration) {
        runForDuration = 0;
        sendMotorCommand(Command.STOP, 0);
    }
    if (running) {
        loop_followLine();
    } else if (turnCommand != TurnCommand.OFF) {
        loop_turn();
    }
});

function sendMotorCommand(command: Command, speed: number) {
    if (command == Command.STOP) {
        maqueen.motorRun(maqueen.Motors.All, maqueen.Dir.CW, 0)
    } else if (command == Command.FWD) {
        maqueen.motorRun(maqueen.Motors.All, maqueen.Dir.CW, speed)
    } else if (command == Command.BKW) {
        maqueen.motorRun(maqueen.Motors.All, maqueen.Dir.CCW, speed)
    } else if (command == Command.LEFT) {
        maqueen.motorRun(maqueen.Motors.M1, maqueen.Dir.CW, speed)
        maqueen.motorRun(maqueen.Motors.M2, maqueen.Dir.CW, 0)       
    } else if (command == Command.RIGHT) {
        maqueen.motorRun(maqueen.Motors.M1, maqueen.Dir.CW, 0)
        maqueen.motorRun(maqueen.Motors.M2, maqueen.Dir.CW, speed)       
    } else if (command == Command.TURN_LEFT) {
        maqueen.motorRun(maqueen.Motors.M1, maqueen.Dir.CCW, speed)
        maqueen.motorRun(maqueen.Motors.M2, maqueen.Dir.CW, speed)       
    } else if (command == Command.TURN_RIGHT) {
        maqueen.motorRun(maqueen.Motors.M1, maqueen.Dir.CW, speed)
        maqueen.motorRun(maqueen.Motors.M2, maqueen.Dir.CCW, speed)       
    }
}

function loop_turn() {
    // heads up! other meaning than in loop_followLine()
    const newLeft = maqueen.readPatrol(maqueen.Patrol.PatrolLeft)
    const newRight = maqueen.readPatrol(maqueen.Patrol.PatrolRight)
    
    if (turnState == TurnState.MOTOR_JUST_STARTED) {
        if (turnCommand == TurnCommand.TURN_RIGHT && left == 0 && newLeft == 1 || // left just exited the band
            turnCommand == TurnCommand.TURN_LEFT && right == 0 && newRight == 1) {
            turnState = TurnState.SECOND_WENT_OFF;
        }
    } else if (turnState == TurnState.SECOND_WENT_OFF) {
        if (turnCommand == TurnCommand.TURN_RIGHT && newRight == 0 ||
            turnCommand == TurnCommand.TURN_LEFT && newLeft == 0) { 
            // turnState = TurnState.FIRST_ON;
            // sendMotorCommand(turnCommand == TurnCommand.TURN_RIGHT ? Command.TURN_RIGHT : Command.TURN_LEFT, speed / 4);
            sendMotorCommand(Command.STOP, 0);
            turnCommand = TurnCommand.OFF;
        } 
    } else if (turnState == TurnState.FIRST_ON) {
        if (turnCommand == TurnCommand.TURN_RIGHT && newLeft == 0 ||
            turnCommand == TurnCommand.TURN_LEFT && newRight == 0) {
            sendMotorCommand(Command.STOP, 0);
            turnCommand = TurnCommand.OFF;
        }
    }

    left = newLeft;
    right = newRight;

    // serial.writeNumber(turnState);
}

function loop_followLine() {
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

    // atentie: cred ca da stack overflow de la concatenare
    // serial.writeLine("cmd=" + lastLateral + ",i=" + inertia);

    if (newCommand == Command.FWD) {
        if (inertia >= 1) { inertia--; }
    } else if (newCommand != Command.BKW) {
        if (inertia < inertiaMax) { inertia++; }
    }

    if (newCommand == command) { return; }
    command = newCommand;
    sendMotorCommand(command, speed);
}

input.onButtonPressed(Button.A, function () {
    setRunning(!running)
})

input.onButtonPressed(Button.B, function () {
    setTurning(false);
})

function setTurning(left: boolean) {
    turnState = TurnState.MOTOR_JUST_STARTED;
    turnCommand = !left ? TurnCommand.TURN_RIGHT : TurnCommand.TURN_LEFT;
    sendMotorCommand(!left ? Command.TURN_RIGHT : Command.TURN_LEFT, speed);
}

function setRunning(value: boolean) {
    running = value
    left = right = -1
    maqueen.motorRun(maqueen.Motors.All, maqueen.Dir.CW, value ? speed : 0)
    sendMotorCommand(value ? Command.FWD : Command.STOP, speed);
}

bluetooth.onBluetoothConnected(function () {
    basic.showString("C")
})

bluetooth.onBluetoothDisconnected(function () {
    basic.showString("D")
})

bluetooth.onUartDataReceived(serial.delimiters(Delimiters.SemiColon), function () {
    let str = bluetooth.uartReadUntil(serial.delimiters(Delimiters.SemiColon));
    serial.writeString("Received via BLE: ");
    serial.writeLine(str);
    if (str == "S") { setRunning(false); } 
    else if (str == "F") { setRunning(true); }
    else if (str == "L") { setTurning(true); }
    else if (str == "R") { setTurning(false); }
    else if (str == "B") { sendMotorCommand(Command.BKW, speed); }
    else if (str.indexOf("BD ") == 0) { 
        running = false;
        const spl = str.split(" ");
        serial.writeLine("Will backward for ms = " + runForDuration);
        sendMotorCommand(Command.BKW, speed); 
        runForDuration = parseInt(spl[1]);
        runForDurationStart = control.millis();
        return; // don't show on screen
    }
    basic.showString(str);
})


