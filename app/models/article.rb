# == Schema Info
#
# Table name: articles
#
#  id             :integer         not null, primary key
#  user_id        :integer
#  title          :string(255)
#  body           :text
#  created_at     :datetime
#  updated_at     :datetime
#  comments_count :integer         not null, default(0)

class Article < ActiveRecord::Base
  
  attr_accessible :title, :body
  
  belongs_to :user, :counter_cache => true
  has_many :comments, :as => :resource, :dependent => :destroy
  
  validates_presence_of :user_id, :title, :body
    
  def self.get(page = 1)
    paginate(:page => page, :per_page => 10, :order => 'created_at desc', :include => :user)
  end
  
  def to_s
    title
  end
  
  def to_param
    "#{id}-#{to_s.parameterize}"
  end
  
end
