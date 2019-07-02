Vue.config.keyCodes.f1 = 112;
Vue.config.keyCodes.f5 = 116;
Vue.config.keyCodes.f6 = 117;

var app = new Vue({
    el: '#app',
    data: {
	index: 0,
	points: 0,
	qcall: 'SA0LAT',
	ccall: '',
	ecall: '',
        inputs: '',
        freq: 670,
        speed: 40,
	attack: 0.005,
	release: 0.005,
	c: '',
	morseQueue: [],
	play: false,
	morsetab: morseTable,
	calltab: callsignTable,
	senttab: [],
	resultColor: "black"
    },
    created: function() {
	this.audio = new AudioContext();

	this.amp = this.audio.createGain();
	this.amp.gain.value = 0;
	this.amp.connect(this.audio.destination);

	this.osc = this.audio.createOscillator();
	this.osc.frequency.value = this.freq;
	this.osc.start(this.audio.currentTime);
	this.osc.connect(this.amp);

	this.sched = new WebAudioScheduler({ context: this.audio });
	this.sched.start(this.runner);
	this.qcall = this.pickcall(0);
	document.getElementById("inp").focus();
    },
    watch: {
	freq: function(f) {
	    this.osc.frequency.value = f;
	},
	speed: function(s) {
	    if(s < this.farnsworth) {
		this.farnsworth = s;
	    }
	},
	farnsworth: function(s) {
	    if(s > this.speed) {
		this.speed = s;
	    }
	}
    },
    computed: {
	farnsworth: function () { return this.speed; },
	dit: function() { return 60.0/(this.speed*10); },
	dah: function() { return 3*this.dit; },
	espace: function() { return this.dit; },
	fdit: function() { return 60.0/(this.farnsworth*10); },
	cspace: function() { return 3*this.fdit; },
	wspace: function () { return 7*this.fdit },
	sending: function() { return (this.c + this.morseQueue.join('')).substr(0,36) },
	progress: function() {
	    if(this.message.length > 0)
		return 1-(this.morseQueue.length/this.message.length);
	    else
		return 0;
	},
	playstate: function() {
	    if(this.play)
		return "STOP"
	    else
		return "START"
	}
    },	
    methods: {
	uinput: function(e) {
	    if (this.morseQueue.length > 0) {
		return;
	    }
	    this.repeated = false;
	    this.ccall = this.qcall;
	    this.ecall = this.inputs;
	    this.inputs = "";
	    this.index++;
	    if (this.ecall == this.ccall) {
		this.resultColor = "green";
		this.points++;
		this.speed += 1;
	    } else {
		this.resultColor = "red";
	    }
	    this.qcall = this.pickcall(0);
	    //this.farnsworth += 2;
	    this.freq = Math.floor(Math.random()*400+330)
	    console.log("New f: " + this.freq + " Hz");
	    this.send(this.qcall);
	},
	repeat: function(e) {
	    console.log(e);
	    e.preventDefault();
	    this.send(this.qcall);
	},
	runner: function(e) {
	    var t = e.playbackTime;
	    if ((this.morseQueue.length > 0) && this.play) {
		t2 = Date.now()/1000.0;
		console.log('runner tick, queue=', this.morseQueue);
		this.c = this.morseQueue.shift();
		var m = this.morsetab[this.c];
		if (m) {
		    for (var i = 0; i < m.length; i++) {
			switch(m[i]) {
			case '.':
			    this.amp.gain.setValueAtTime(0, t);
			    this.amp.gain.linearRampToValueAtTime(1, t+this.attack);
			    t += this.dit;
			    this.amp.gain.setValueAtTime(1, t);
			    this.amp.gain.linearRampToValueAtTime(0, t+this.release);
			    t += this.espace-this.release;
			    break;
			case '-':
			    this.amp.gain.setValueAtTime(0, t);
			    this.amp.gain.linearRampToValueAtTime(1, t+this.attack);
			    t += this.dah;
			    this.amp.gain.setValueAtTime(1, t);
			    this.amp.gain.linearRampToValueAtTime(0, t+this.release);
			    t += this.espace;
			    break;
			case '_':
			    t += this.dit*1.5;
			    break;
			case ' ':
			    t += this.wspace-this.espace-this.cspace;
			    break;
			}
		    }
		}
	    } else {
		this.c = '';
	    }
	    t += this.cspace-this.espace-this.release;
	    this.sched.insert(t, this.runner);
	},
	clear: function(e) {
	    this.message = "";
	    this.morseQueue = [];
	},
	send: function(s) {
	    if(this.morseQueue.length <= 0) {
		for(i in s) {
		    this.morseQueue.push(s[i].toUpperCase());
		}
	    } else {
		this.play = true;
	    }
	    this.focus();
	},
	pickcall: function(i) {
	    if (this.qcall != this.senttab[this.senttab.length-1] ) {
		this.senttab.push(this.qcall);
	    }

	    i = Math.floor(Math.random()*this.calltab.length)
	    console.log("candidate index: " + i);
	    call = this.calltab[i]
	    console.log("candidate: " + call);
	    if (this.senttab.find(c => c == call)) {
		console.log(call + " taken, picking new");
		return this.pickcall(i+1)
	    } else {
		return call;
	    }
	},
	playpause: function(e) {
	    e.preventDefault();
	    this.play = !this.play;
	    if (this.play && this.morseQueue.length <= 0) {
		this.audio.resume();
		this.send(this.qcall);
	    }
	},
	focus: function() {
	    document.getElementById("inp").focus();
	}
    }
});
