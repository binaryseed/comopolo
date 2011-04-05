load 'deploy' if respond_to?(:namespace) # cap2 differentiator



$:.unshift(File.expand_path('./lib', ENV['rvm_path']))
require "rvm/capistrano"
set :rvm_type, :user


set :user, "binaryseed"
set :application, "comopolo"
set :ssh_options, { :forward_agent => true }
set :use_sudo, false


set :scm, :git
set :repository,  "git@github.com:binaryseed/comopolo.com.git"
set :branch, :master
set :deploy_via, :remote_cache


set :server_ip, "node"
set :deploy_to, "/home/binaryseed/srv/comopolo_cap"
server server_ip, :app, :web, :db, :primary => true


namespace :deploy do
	
	desc "Restarting app"
	task :restart do
		run "touch #{current_path}/tmp/restart.txt"
	end
	
	task :finalize_update do

		run "[ -d #{release_path}/log ] || mkdir #{release_path}/log"
		run "[ -d #{release_path}/tmp ] || mkdir #{release_path}/tmp"
		
	end
	
	task :symlink do
		
		run "rm -f #{current_path}"
		run "ln -s #{release_path} #{current_path}"
		
		run "ln -s #{shared_path}/config.yml #{release_path}/config/config.yml"
		run "ln -s #{shared_path}/database.yml #{release_path}/config/database.yml"
		
		run "ln -s #{shared_path}/avatars #{release_path}/public/avatars"
		run "ln -s #{shared_path}/files #{release_path}/public/files"
		run "ln -s #{shared_path}/headers #{release_path}/public/headers"
		run "ln -s #{shared_path}/themes #{release_path}/public/themes"
	end
	
end
