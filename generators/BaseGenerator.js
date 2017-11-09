const CONFIG = require('../config.json');

const util = require('util');
const fs = require('fs');
const exec = require('child_process').exec;
const http = require('http');

module.exports = class BaseGenerator {
  constructor(format) {    
    this.format = format;
    this.CODEGEN_VERSION = '2.2.3';
    this.SPEC_VERSION = '1.0.0-preview-1';
    this.SPEC_URL = util.format('https://app.swaggerhub.com/apiproxy/schema/file/iatec/Employee/%s/swagger.yaml', this.SPEC_VERSION);
    this.options = CONFIG.formatOptions[format];
    
    this.outdir = 'output/' + this.options.languageArgs.npmName;
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
    if ('languageArgs' in this.options) {
      if ('languageArgVersionName' in this.options) {
        this.options.languageArgs[this.options.languageArgVersionName] = this.SPEC_VERSION;
      }
      Object.keys(this.options.languageArgs).forEach(k=> {
        javaArgs.push(`-D${k}=${this.options.languageArgs[k]}`);
      });
    }
    console.log('Running codegen...');
    await this.runcmd('java ' + javaArgs.join(' '));
  }
  async generate() {
    this.codegenName = await this.ensureCodegen();
    await this.runCodegen();
  }
  runcmd(cmd, workingdir){
    return new Promise((resolve, reject) => {
      let child = exec(cmd, {'cwd': workingdir || process.cwd() }, (err, stdout, stderr) =>{
        if (!err) resolve(stdout);
        else reject(err);
      });
      child.stderr.pipe(process.stdout);
      child.stdout.pipe(process.stdout);
    });
  }
  async gitPush() {
    let user_name = '';
    let repo_name = '';
    let gitCommands = [
      `init`,
      `add .`,
      `commit -m "Auto-generated commit"`,
      `remote add origin https://github.com/${user_name}/${repo_name}.git`,
      `tag ${this.SPEC_VERSION}`,
      `push -u origin master`,
    ];
    for (let g of gitCommands) {
      await runcmd('git ' + g, this.outdir);
    }
  }
}