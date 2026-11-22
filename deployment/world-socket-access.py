#!/usr/bin/env python3
"""Scope a local native UID to its own return lane; root transports remain trusted.

Operator-only systemd lifecycle hook. Never reads credentials or changes grants.
The protected configuration, rather than a package/browser, fixes the sockets.
"""
import argparse
from contextlib import ExitStack
import json
import os
from pathlib import Path
import stat
import subprocess
import time


def acl(fd):
    path = f"/proc/self/fd/{fd}"
    result = subprocess.run(['/usr/bin/getfacl', '-cpn', str(path)], check=True,
                            capture_output=True, text=True, timeout=3, pass_fds=(fd,))
    return result.stdout.splitlines()


def edit(fd, *args):
    # Pin the validated inode: application code can rename sockets in its own
    # directory, but must never redirect a privileged ACL update via a symlink.
    subprocess.run(['/usr/bin/setfacl', *args, f'/proc/self/fd/{fd}'],
                   check=True, timeout=3, pass_fds=(fd,),
                   stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def apply(config, phase):
    if os.geteuid() != 0:
        raise ValueError('operator_root_required')
    if set(config) != {'directory', 'native_uid', 'app_uid', 'own_socket', 'foreign_sockets'}:
        raise ValueError('closed_socket_policy_required')
    directory = Path(config['directory'])
    names = [config['own_socket'], *config['foreign_sockets']]
    if (not directory.is_absolute() or directory.is_symlink()
            or not 1 <= len(names) <= 8 or len(set(names)) != len(names)
            or any(not isinstance(name, str) or Path(name).name != name
                   or not name.endswith('.sock') or name in {'.sock', '..sock'} for name in names)
            or any(type(config[key]) is not int or config[key] < 1 for key in ('native_uid', 'app_uid'))
            or config['native_uid'] == config['app_uid']):
        raise ValueError('invalid_fixed_socket_policy')
    with ExitStack() as fds:
        directory_fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        fds.callback(os.close, directory_fd)
        return apply_directory(config, phase, directory, directory_fd, fds)


def apply_directory(config, phase, directory, directory_fd, fds):
    names = [config["own_socket"], *config["foreign_sockets"]]
    info = os.fstat(directory_fd)
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != config['app_uid']:
        raise ValueError('receiving_directory_owner_changed')
    uid = config['native_uid']
    if f'default:user:{uid}:rwx' in acl(directory_fd):
        edit(directory_fd, '-x', f'd:u:{uid}')
    if any(line.startswith(f'default:user:{uid}:') for line in acl(directory_fd)):
        raise ValueError('foreign_socket_inheritance_preserved')
    # Traversal permits this native body's own lane, never another lane's write.
    edit(directory_fd, '-m', f'u:{uid}:rx')
    if phase == 'pre':
        return {'phase': phase, 'default_native_socket_grant': False}
    until = time.monotonic() + 12
    while not all((directory/name).exists() for name in names):
        if time.monotonic() >= until:
            raise ValueError('receiving_socket_startup_unconfirmed')
        time.sleep(.05)
    sockets = {}
    identities = set()
    for name in names:
        fd = os.open(name, os.O_PATH | os.O_NOFOLLOW, dir_fd=directory_fd)
        fds.callback(os.close, fd)
        info = os.fstat(fd)
        if not stat.S_ISSOCK(info.st_mode) or info.st_uid != config['app_uid']:
            raise ValueError('receiving_socket_owner_changed')
        identity = (info.st_dev, info.st_ino)
        if identity in identities:
            raise ValueError('receiving_socket_inode_reused')
        identities.add(identity)
        sockets[name] = fd
    for name in config['foreign_sockets']:
        fd = sockets[name]
        if any(line.startswith(f'user:{uid}:') for line in acl(fd)):
            edit(fd, '-x', f'u:{uid}')
        if any(line.startswith(f'user:{uid}:') for line in acl(fd)):
            raise ValueError('foreign_socket_native_grant_remains')
    edit(sockets[config['own_socket']], '-m', f'u:{uid}:rw')
    for name in config['foreign_sockets']:
        if any(line.startswith(f'user:{uid}:') for line in acl(sockets[name])):
            raise ValueError('foreign_socket_native_grant_remains')
    for name, fd in sockets.items():
        current = os.stat(name, dir_fd=directory_fd, follow_symlinks=False)
        pinned = os.fstat(fd)
        if (current.st_ino, current.st_dev) != (pinned.st_ino, pinned.st_dev):
            raise ValueError('receiving_socket_replaced_during_acl')
    return {'phase': phase, 'own_socket_granted': True,
            'foreign_native_grants': 0, 'socket_count': len(names),
            'trusted_root_transports_unchanged': True}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    parser.add_argument('--phase', required=True, choices=['pre', 'post'])
    args = parser.parse_args()
    path = Path(args.config)
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
        raise ValueError('protected_operator_policy_required')
    raw = path.read_bytes()
    if len(raw) > 4096:
        raise ValueError('socket_policy_capacity')
    print(json.dumps(apply(json.loads(raw), args.phase)))
