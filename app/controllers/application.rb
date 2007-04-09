class ApplicationController < ActionController::Base
  
  helper_method :current_user, :logged_in?, :force_login, :reset_online_at, :is_online?, :admin?, :check_admin, :redirect_to_home, :can_edit?
  before_filter :update_online_at, :get_reminders, :get_stats, :get_options
    
  session :session_key => '_eldorado_session_id'
  
  protected
    
  def current_user
    @current_user ||= ((session[:user_id] && User.find_by_id(session[:user_id])) || 0)
  end
    
  def logged_in?()
    current_user != 0
  end
  
  def force_login
    redirect_to login_path and return false unless logged_in?
  end
  
  def update_online_at
    return unless logged_in?
    User.update_all ['online_at = ?', Time.now.utc], ['id = ?', current_user.id] 
  end
    
  def reset_online_at
    User.update_all ['online_at = ?', Time.now.utc-5.minutes], ['id = ?', current_user.id] 
  end
  
  def is_online?(user)
    User.find(:first, :conditions => ["id = ? and online_at > ?", user.id, Time.now.utc-5.minutes])
  end
  
  def admin?()
    logged_in? && (current_user.admin == true)
  end
  
  def check_admin
    redirect_to home_path and return false unless admin?
  end
  
  def redirect_to_home
    redirect_to home_path and return false
  end
  
  def can_edit?(current_item)
    return false unless logged_in?
    if request.path_parameters['controller'] == "users"
      return current_user.admin? || (current_user.id == current_item.id) 
    else
      return current_user.admin? || (current_user.id == current_item.user_id) 
    end
  end
  
  def get_reminders
    if logged_in?
      @reminders = Event.find(:all, :order => 'date asc', :conditions => ["DATE(date) = ? and reminder = ?", Date.today, true])
    else
      @reminders = Event.find(:all, :order => 'date asc', :conditions => ["DATE(date) = ? and reminder = ? and private = ?", Date.today, true, false])
    end
  end
  
  def get_stats
    @user_count = User.count
    @topics_count = Topic.count
    @posts_count = Post.count
    @newest_user = User.find(:first, :order => "created_at desc")
  end
  
  def get_options
    @options = Option.find(:first)
  end
        
end