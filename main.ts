enum Command { FWD, BKW, LEFT, RIGHT }

let speed = 100
let debounceMs = 0
let waitNewLateral = 1000

// in aer = 0
// pe podea alb = 1, negru = 0
let left = -1
let right = -1
let leftWaitingForDebounce = -1
let rightWaitingForDebounce = -1
let timestampOfLastModification = -1
let timestampOfLastLateral = -1
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

    // if (newLeft == leftWaitingForDebounce && newRight == rightWaitingForDebounce) {
    //   // values didn't change
    //   if (now <= timestampOfLastModification + debounceMs) {
    //       // but the waiting time has not passed; so wait a bit more
    //       return;
    //   } // else the time passed, so continue
    // } else {
    //     // the values did change
    //     timestampOfLastModification = now;
    //     leftWaitingForDebounce = newLeft;
    //     rightWaitingForDebounce = newRight;
    //     return;
    // }

    // if (newLeft == left && newRight == right) {
    //     // nothing changed
    //     return;
    // }
    // serial.writeString("now="); serial.writeNumber(now);
    // serial.writeString(", command crt="); serial.writeNumber(command);
    // serial.writeString(", l="); serial.writeNumber(left);
    // serial.writeString("/"); serial.writeNumber(newLeft);
    // serial.writeString(", r="); serial.writeNumber(right);
    // serial.writeString("/"); serial.writeNumber(newRight);
    // serial.writeString(", lastLat="); serial.writeNumber(lastLateral);
    // serial.writeString(", lastLatTS="); serial.writeNumber(timestampOfLastLateral);
    // serial.writeLine("")

    if (command == Command.LEFT || command == Command.RIGHT) {
    //     timestampOfLastLateral = now;
        lastLateral = command
    }

    let newCommand = command;
    if (command == Command.FWD // going forward
            && newLeft == 1 && newRight == 1) { // and left the track
        // const waitingOver = now > timestampOfLastLateral + waitNewLateral;
        if (newLeft != left && (lastLateral == Command.RIGHT || inertia == 0)) {
            // just exited w/ left sensor; so from now on go left to try 
            // to reenter the track
            newCommand = Command.RIGHT
        } else if (newRight != right && (lastLateral == Command.LEFT || inertia == 0)) {
            newCommand = Command.LEFT;
        } else if (inertia > 0) {
            newCommand = lastLateral
        }

        // if (lastLateral < 0 || waitingOver || newCommand == lastLateral) {
        //     // we'll continue
        // } else {
        //     serial.writeLine("Ignoring new command=" + newCommand)
        //     return;
        // }
    } else { // searching for track
        if (newLeft == 1 && newRight == 1) {
            // still out; so nothing to do
        } else {
        // if (newLeft == 0 && newRight == 0 // somehow both on black, so definitly back on track
        //     || newLeft != left && command == Command.RIGHT // back on track, but w/ the led that just left
        //     || newRight != right && command == Command.LEFT) { // idem
            newCommand = Command.FWD;
        } 
    }

    left = newLeft
    right = newRight

    // serial.writeString("new command="); serial.writeNumber(newCommand);
    // serial.writeLine("");

    // if (command == newCommand) {
    //     return;
    // } 

    // command = newCommand;
    // let newCommand = Command.FWD;

    // if (newLeft == 0 && newRight == 0) {
    //     // both in
    //     // lineFollowFlag = lineFollowFlagMiddle
    // } else if (newLeft == 0 && newRight == 1) {
    //     // left in
    //     if (lineFollowFlag > 1) { lineFollowFlag--; }
    // } else if (newLeft == 1 && newRight == 0) {
    //     // right in
    //     if (lineFollowFlag < lineFollowFlagMiddle * 2) { lineFollowFlag++; }
    // } else {
    //     // both out
    //     if (lineFollowFlag == lineFollowFlagMiddle) { newCommand = Command.BKW; }
    //     if (lineFollowFlag < lineFollowFlagMiddle) { newCommand = Command.RIGHT; }
    //     if (lineFollowFlag > lineFollowFlagMiddle) { newCommand = Command.LEFT; }
    // }

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
    basic.showString(bluetooth.uartReadUntil(serial.delimiters(Delimiters.SemiColon)))
})


