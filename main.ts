enum Command { STOP, FWD, BKW, LEFT, RIGHT, TURN_LEFT, TURN_RIGHT }

let speed = 100

// in aer = 0
// pe podea alb = 1, negru = 0
let left = -1
let right = -1
let newLeft = -1
let newRight = -1
let newLeftForDebouce = -1
let newLeftForDebounceInertia: number
let newRightForDebounce = -1
let newRightForDebounceInertia: number
let debounceInertiaMax: number;

let lastLateral: Command;

let running = false
let command: Command;

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
serial.writeLine("salut")
bluetooth.startUartService()
sendMotorCommand(Command.STOP, 0);

// main loop
basic.forever(function on_forever() {
    iter++;

    const leftSensor = maqueen.readPatrol(maqueen.Patrol.PatrolLeft)
    if (leftSensor != newLeftForDebouce) { 
        newLeftForDebouce = leftSensor;
        newLeftForDebounceInertia = debounceInertiaMax; 
    }
    //  else
    {
        if (newLeftForDebounceInertia >= 0) { newLeftForDebounceInertia--; } // last execution => -1
        if (newLeft < 0 || newLeftForDebounceInertia == 0) {
            newLeft = newLeftForDebouce;
        }
    }

    const rightSensor = maqueen.readPatrol(maqueen.Patrol.PatrolRight)
    if (rightSensor != newRightForDebounce) { 
        newRightForDebounce = rightSensor;
        newRightForDebounceInertia = debounceInertiaMax; 
    } 
    // else
    {
        if (newRightForDebounceInertia >= 0) { newRightForDebounceInertia--; } // last execution => -1
        if (newRight < 0 || newRightForDebounceInertia == 0) {
            newRight = newRightForDebounce;
        }
    }

    // newLeft = maqueen.readPatrol(maqueen.Patrol.PatrolLeft)
    // newRight = maqueen.readPatrol(maqueen.Patrol.PatrolRight)

    // if (newLeft != left || newRight != right) {
    //     serial.writeNumber(iter);
    //     if (newLeft != left) { serial.writeString("l"); serial.writeNumber(newLeft); }
    //     if (newRight != right) { serial.writeString("r"); serial.writeNumber(newRight); }
    //     serial.writeLine("");
    // }

    if (runForDuration && control.millis() > runForDurationStart + runForDuration) {
        runForDuration = 0;
        sendMotorCommand(Command.STOP, 0);
    }
    if (running) {
        loop_followLine();
    } else if (turnCommand != TurnCommand.OFF) {
        loop_turn();
    }

    left = newLeft;
    right = newRight;
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
    if (turnState == TurnState.MOTOR_JUST_STARTED) {
        if (newLeft == 1 && newRight == 1
            || turnCommand == TurnCommand.TURN_RIGHT && (left == 0 && newLeft == 1)  // left just exited the band
            || turnCommand == TurnCommand.TURN_LEFT && right == 0 && newRight == 1) {
            turnState = TurnState.SECOND_WENT_OFF;
        }
    } else if (turnState == TurnState.SECOND_WENT_OFF) {
        if (turnCommand == TurnCommand.TURN_RIGHT && newRight == 0 ||
            turnCommand == TurnCommand.TURN_LEFT && newLeft == 0) { 
            // turnState = TurnState.FIRST_ON;
            // sendMotorCommand(turnCommand == TurnCommand.TURN_RIGHT ? Command.TURN_RIGHT : Command.TURN_LEFT, speed / 4);
            sendMotorCommand(Command.STOP, 0);
            turnCommand = TurnCommand.OFF;
            bluetooth.uartWriteString("turnEnd");
        } 
    } 
    // else if (turnState == TurnState.FIRST_ON) {
    //     if (turnCommand == TurnCommand.TURN_RIGHT && newLeft == 0 ||
    //         turnCommand == TurnCommand.TURN_LEFT && newRight == 0) {
    //         sendMotorCommand(Command.STOP, 0);
    //         turnCommand = TurnCommand.OFF;
    //     }
    // }
}

function loop_followLine() {
    const now = control.millis();

    if (command == Command.LEFT || command == Command.RIGHT) {
        lastLateral = command
    }

    let newCommand = command;
    if (command == Command.FWD // going forward
            && newLeft == 1 && newRight == 1) { // and left the track
        if (newLeft != left 
            // && (lastLateral == Command.RIGHT || inertia == 0)
            ) {
            // just exited w/ left sensor; so from now on go left to try 
            // to reenter the track
            newCommand = Command.RIGHT
        } else if (newRight != right
        //  && (lastLateral == Command.LEFT || inertia == 0)
         ) {
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
    // serial.writeString("New command: ");
    // serial.writeNumber(command);
    // serial.writeLine("");
}

input.onButtonPressed(Button.A, function () {
    setRunning(!running)
    // bluetooth.uartWriteString("turnEnd");
})

input.onButtonPressed(Button.B, function () {
    setTurning(false);
})

function setTurning(isLeft: boolean) {
    turnState = TurnState.MOTOR_JUST_STARTED;
    turnCommand = !isLeft ? TurnCommand.TURN_RIGHT : TurnCommand.TURN_LEFT;
    sendMotorCommand(!isLeft ? Command.TURN_RIGHT : Command.TURN_LEFT, speed);

    // important, this way they are valid also for first loop
    // left = maqueen.readPatrol(maqueen.Patrol.PatrolLeft)
    // right = maqueen.readPatrol(maqueen.Patrol.PatrolRight)
    left = newLeft
    right = newRight

    debounceInertiaMax = 1;
}

let iter = 0;

function setRunning(value: boolean) {
    // serial.writeNumber(iter);
    // serial.writeLine("setRunning");
    iter = 0;
    running = value
    left = newLeft
    right = newRight
    inertia = 0
    debounceInertiaMax = 2;
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
    // serial.writeString("BLE: ");
    // serial.writeLine(str);
    if (str == "S") { setRunning(false); } 
    else if (str == "F") { setRunning(true); }
    else if (str == "L") { setTurning(true); }
    else if (str == "R") { setTurning(false); }
    else if (str == "B") { sendMotorCommand(Command.BKW, speed); }
    else if (str.indexOf("BD ") == 0) { 
        running = false;
        const spl = str.split(" ");
        // serial.writeLine("Will backward for ms = " + runForDuration);
        sendMotorCommand(Command.BKW, speed); 
        runForDuration = parseInt(spl[1]);
        runForDurationStart = control.millis();
        return; // don't show on screen
    }
    basic.showString(str);
})


