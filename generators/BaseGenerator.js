const CONFIG = require('../config.json');

const util = require('util');
const fs = require('fs');
const exec = require('child_process').exec;
const http = require('http');

module.exports = class BaseGenerator {
  constructor(format) {    
    this.format = format;
    this.CODEGEN_VERSION = '2.2.3';
    this.SPEC_URL = util.format('https://app.swaggerhub.com/apiproxy/schema/file/iatec/Employee/%s/swagger.yaml', CONFIG.version);
    this.options = CONFIG.formatOptions[format];
    this.outdir = 'output/' + format;
  }
  
  async ensureCodegen() {
    let codegenName = util.format(`swagger-codegen-cli-%s.jar`, this.CODEGEN_VERSION);
    if (fs.existsSync(codegenName)) {
      console.log('Codegen was already downloaded');
    } else {
      let codegenUrl = util.format('http://central.maven.org/maven2/io/swagger/swagger-codegen-cli/%s/%s', this.CODEGEN_VERSION, codegenName);
      console.log('Downloading codegen from', codegenUrl);
      let file = fs.createWriteStream(codegenName);
      http.get(codegenUrl, response => {
        console.log('writing...');
        response.pipe(file);
      });
    }
    return codegenName;
  }
  async runCodegen() {
    let javaArgs = [
      '-jar', this.codegenName,
      'generate',
      '-i', this.SPEC_URL,
      '-l', 'typescript-angular2',
      '-o', this.outdir,
    ];
    if (!('languageArgs' in this.options)) {
      this.options.languageArgs = {};
    }
    if ('_versionNameKey' in this.options) {
      this.options.languageArgs[this.options._versionNameKey] = CONFIG.version;
    }
    if ('_packageNameKey' in this.options) {
      this.options.languageArgs[this.options._packageNameKey] = CONFIG.packageName;
    }
    Object.keys(this.options.languageArgs).forEach(k=> {
      javaArgs.push(`-D${k}=${this.options.languageArgs[k]}`);
    });
    console.log('Running codegen...', javaArgs.join(' '));
    await this.runcmd('java ' + javaArgs.join(' '));
  }
  async generate() {
    this.codegenName = await this.ensureCodegen();
    await this.runCodegen();
  }
  runcmd(cmd, workingdir, options = {}){
    const defaults = {
      stderrPipe: true,
      stdoutPipe: true,
    };
    options = Object.assign(defaults, options)
    return new Promise((resolve, reject) => {
      let child = exec(cmd, {'cwd': workingdir || process.cwd() }, (err, stdout, stderr) =>{
        if (!err) resolve(stdout);
        else if (options.ignoreFailure, reject(err));
      });
      if (options.stdoutPipe) child.stdout.pipe(process.stdout);
      if (options.stderrPipe) child.stderr.pipe(process.stderr);
      
    });
  }
  async gitPush() {
    let user_name = CONFIG.gitHubUsername;
    let repo_name = this.options.packageName;
    let gitCommands = [
      [`init`, ],
      [`remote rm origin`, true],
      [`remote add origin https://github.com/${user_name}/${repo_name}.git`, ],
      [`pull origin master --allow-unrelated -s recursive -X ours`, ],
      [`add .`, ],
      [`commit -m "Auto-generated commit"`, true],
      [`tag -f ${CONFIG.version}`, ],
      [`push --tags -u origin master`, ],
    ];
    for (let g of gitCommands) {
      let canFail = g.length > 1 && g[1];
      try {
        await this.runcmd('git ' + g[0], this.outdir, {stderrPipe: !canFail});
      } catch (err) {
        if (!canFail)
          throw err;
      }
    }
  }
  async publish() {
    throw 'Not implemented for this format';
  }
  async updateJson(filename, func) {
    let obj = JSON.parse(fs.readFileSync(filename));
    obj = func(obj);
    fs.writeFileSync(filename, JSON.stringify(obj, null, 2));
  }
}