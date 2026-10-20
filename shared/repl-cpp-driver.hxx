// Cling-only, in-session driver. No evaluator process, source rewriting or replay.
// Included by the first private driver; this reserved namespace is protocol v1.
#ifndef PI_REPL_CPP_DRIVER_V1
#define PI_REPL_CPP_DRIVER_V1
#include <cling/Interpreter/Interpreter.h>
#include <cling/Interpreter/RuntimeUniverse.h>
#include <cling/MetaProcessor/InputValidator.h>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <exception>
#include <stdexcept>
#include <cerrno>
#include <climits>
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>

namespace pi_repl_cpp_v1 {
using number = unsigned long long;
struct file {
  int fd;
  explicit file(int value) : fd(value) {}
  void close_now() { if (fd >= 0) { close(fd); fd=-1; } }
  ~file() { close_now(); }
  file(const file&) = delete;
};
inline bool decimal(const std::string& text, number& value) {
  if (text.empty() || text.size() > 20) return false;
  value = 0;
  for (char c : text) {
    if (c < '0' || c > '9' || value > (ULLONG_MAX - (c-'0')) / 10) return false;
    value = value * 10 + (c-'0');
  }
  return true;
}
inline bool stem_ok(const std::string& text) {
  if (text.size() != 16 && text.size() != 29) return false;
  for (size_t i=0; i<text.size(); ++i) {
    char c=text[i];
    if (text.size()==29 && i==12) { if (c!='-') return false; }
    else if (!((c>='0' && c<='9') || (c>='a' && c<='f'))) return false;
  }
  return true;
}
inline bool private_file(int fd, number dev, number ino, number size) {
  struct stat s;
  return fd>=0 && fstat(fd,&s)==0 && S_ISREG(s.st_mode)
    && s.st_uid==getuid() && (s.st_mode&0777)==0600 && s.st_nlink==1
    && number(s.st_dev)==dev && number(s.st_ino)==ino && number(s.st_size)==size;
}
inline bool read_exact(int fd, number size, std::string& result) {
  char buffer[4096];
  while (size) {
    ssize_t n=read(fd,buffer,size<sizeof buffer ? size : sizeof buffer);
    if (n<0 && errno==EINTR) continue;
    if (n<=0) return false;
    result.append(buffer,size_t(n)); size-=number(n);
  }
  // Reject growth as well as truncation; never read unbounded user input.
  char extra; return read(fd,&extra,1)==0;
}
inline bool field(const std::string& request, size_t& position, std::string& result) {
  size_t end=request.find('\n',position); number size;
  if (end==std::string::npos || !decimal(request.substr(position,end-position),size)
      || size>request.size()-end-1) return false;
  position=end+1; result=request.substr(position,size); position+=size; return true;
}
inline int evaluate(const std::string& source) {
  cling::InputValidator validator;
  int result=0; size_t position=0;
  while (position<source.size()) {
    size_t end=source.find('\n',position);
    std::string line=source.substr(position,end==std::string::npos ? end : end-position);
    position=end==std::string::npos ? source.size() : end+1;
    if (validator.validate(line)==cling::InputValidator::kIncomplete) { result=2; continue; }
    std::string input; validator.reset(&input);
    result=static_cast<int>(cling::runtime::gCling->process(input));
    if (result!=0) break;
  }
  if (result==2) fputs("pi-repl: incomplete C++ prompt group; no continuation is queued\n",stderr);
  return result;
}
inline void submit(const char* request_path, number root_dev, number root_ino,
                   number request_dev, number request_ino, number request_size) {
  static const pid_t owner_pid = getpid();
  int response_fd=-1;
  char reply[128]; size_t reply_size=0;
  {
  // All descriptors and source/evaluator locals die before publication.
  // Source/request failure before a valid family is decoded fails closed.
  std::string root_path, stem, footer;
  int result=5;
  try {
    std::string path(request_path);
    size_t slash=path.rfind('/');
    if (slash==std::string::npos || request_size>65536) throw std::runtime_error("invalid request path or size");
    root_path=path.substr(0,slash);
    std::string name=path.substr(slash+1);
    if (name.size()<5 || name.substr(name.size()-4)!=".req" || !stem_ok(name.substr(0,name.size()-4))) throw std::runtime_error("invalid request name");
    file root(open(root_path.c_str(),O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC));
    struct stat rs;
    if (root.fd<0 || fstat(root.fd,&rs)!=0 || rs.st_uid!=getuid() || (rs.st_mode&0777)!=0700
        || number(rs.st_dev)!=root_dev || number(rs.st_ino)!=root_ino) throw std::runtime_error("private directory changed");
    file request(openat(root.fd,name.c_str(),O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC));
    std::string body;
    if (!private_file(request.fd,request_dev,request_ino,request_size) || !read_exact(request.fd,request_size,body)) throw std::runtime_error("request identity or read failed");
    const std::string magic="pi-repl-cpp-v1\n";
    if (body.compare(0,magic.size(),magic)!=0) throw std::runtime_error("unknown request protocol");
    size_t position=magic.size(); std::string fields[6];
    for (auto& value : fields) if (!field(body,position,value)) throw std::runtime_error("invalid request frame");
    number dev,ino,size;
    if (position!=body.size() || !stem_ok(fields[0]) || !decimal(fields[1],dev)
        || !decimal(fields[2],ino) || !decimal(fields[3],size) || size>16*1024*1024
        || fields[5].find('\0')!=std::string::npos) throw std::runtime_error("invalid request fields");
    stem=fields[0]; footer=fields[5];
    file source_file(openat(root.fd,(stem+".cpp").c_str(),O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC));
    std::string source;
    if (!private_file(source_file.fd,dev,ino,size) || !read_exact(source_file.fd,size,source)
        || source.find('\0')!=std::string::npos) throw std::runtime_error("source identity or read failed");
    // Do not keep control descriptors in the user's running workspace. A user
    // closing/reusing a descriptor must not make our later destructor close it.
    source_file.close_now(); request.close_now(); root.close_now();
    fwrite(fields[4].data(),1,fields[4].size(),stderr); fflush(stderr);
    try { result=evaluate(source); }
    catch (const std::exception& error) {
      fprintf(stderr,"pi-repl caught std::exception: %s\n",error.what()); result=3;
    } catch (...) { fputs("pi-repl caught non-standard C++ exception\n",stderr); result=4; }
  } catch (const std::exception& error) {
    fprintf(stderr,"pi-repl C++ control error: %s\n",error.what());
  } catch (...) { fputs("pi-repl C++ control error\n",stderr); }
  fflush(stdout); fflush(stderr);
  if (getpid()!=owner_pid || stem.empty()) return;
  // Like the other native adapters, the optional display uses existing Node
  // and a bounded read-only cursor query. It is NOT completion authority.
  if (!footer.empty() && std::system(footer.c_str())!=0) fputs("\n",stderr);
  fflush(stdout); fflush(stderr);
  file root(open(root_path.c_str(),O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC));
  struct stat rs;
  if (root.fd<0 || fstat(root.fd,&rs)!=0 || rs.st_uid!=getuid() || (rs.st_mode&0777)!=0700
      || number(rs.st_dev)!=root_dev || number(rs.st_ino)!=root_ino) return;
  response_fd=openat(root.fd,(stem+".done").c_str(),O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);
  if (response_fd<0 || fchmod(response_fd,0600)!=0) {
    perror("pi-repl C++ response"); if (response_fd>=0) close(response_fd); return;
  }
  int count=snprintf(reply,sizeof reply,"pi-repl-cpp-v1 %s %d\n",stem.c_str(),result);
  if (count<0 || size_t(count)>=sizeof reply) { close(response_fd); return; }
  reply_size=size_t(count);
  } // Every helper-owned C++ object is destroyed before the reply is written.
  // Empty/partial frames are pending. No destructor or user source follows this
  // publication, only POSIX write/close and the driver's scalar initialization.
  if (getpid()!=owner_pid) { close(response_fd); return; }
  size_t written=0;
  while (written<reply_size) {
    ssize_t n=write(response_fd,reply+written,reply_size-written);
    if (n<0 && errno==EINTR) continue;
    if (n<=0) break;
    written+=size_t(n);
  }
  close(response_fd);
}
}
#endif
